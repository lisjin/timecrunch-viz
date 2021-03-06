from flask import *
from extensions import db, comps

import re
import requests

api = Blueprint('api', __name__, template_folder='templates')


def get_region(node_id):
	return comps[node_id] if node_id in comps else ''


def parse_node_id(node_str):
	return int(re.findall('\/n\d+', node_str)[0][2:])


def parse_traversal_results(traversal_results, split_start):
	results = []
	for path in traversal_results['paths']:
		id_pref = ''
		source = parse_node_id(path['edges'][0]['_from'])
		target = parse_node_id(path['edges'][0]['_to'])
		if split_start:
			id_pref = 'L' if source < int(split_start) or target < int(split_start) else 'R'
		results.append({
			'source': source,
			'target': target,
			'tstep': int(path['edges'][0]['tstep']),
			'id': id_pref + path['edges'][0]['tstep'] + '_' + re.findall('\d+', path['edges'][0]['id'])[0]
		})
	return results


def get_tsteps_count(graph_name, r_type):
	query = """
	FOR e in %s COLLECT tstep = TO_NUMBER(e.tstep) WITH COUNT into counter
		RETURN {x: tstep, y: (100 * 99 - 2 * counter) / (100 * 99), c: @r_type_id}'
	""" % (graph_name + '_edges')
	return db.aql.execute(query, bind_vars={'r_type_id': r_type})


def construct_tc_query(parts):
	parts[1] = 'Rest' if parts[1] == 'R' else 'MindfulRest'
	return 'data/' + parts[0] + '/' + parts[0] + '_' + parts[1] + '+0.' + parts[2][1:] + '-' + parts[3] + '.json'


def get_traversal_results(nodes, graph_name, nodes_str, tstep, split_start):
	all_edges = []
	for node in nodes:
		traversal_results = db.graph(graph_name).traverse(
			start_vertex= graph_name + '_nodes/n' + str(node),
			strategy='bfs',
			edge_uniqueness='global',
			min_depth=1,
			max_depth=1,
			filter_func="""
				var node_set = new Set([%s])
				if (!node_set.has(vertex._id) ||
				(path.edges.length && (path.edges[0].tstep != %s || path.edges[0]._from > path.edges[0]._to))) {
					return ["prune", "exclude"];
				}
				return;
			""" % (nodes_str, tstep)
		)
		all_edges += parse_traversal_results(traversal_results, split_start)
	return all_edges


@api.route('/api/traverse/<graph_name>')
def traverse_route(graph_name):
	tstep = request.args.get('tstep')
	struc = int(request.args.get('struc'))
	split_start = request.args.get('split_start')

	parts = graph_name.split('_')
	response = json.loads(requests.get(request.url_root + construct_tc_query(parts)).text)
	nodes = response[struc]['nodes']
	nodes_str = ', '.join(['\"' + graph_name + '_nodes/n' + n + '\"' for n in nodes])

	all_nodes = [{'id': int(node), 'label': node, 'region': get_region(int(node))} for node in nodes]
	all_edges = get_traversal_results(nodes, graph_name, nodes_str, tstep, split_start)
	return jsonify({'nodes': all_nodes, 'edges': all_edges})


@api.route('/api/timesteps/<graph_name>')
def timesteps_route(graph_name):
	r_type = request.args.get('r_type')

	c = get_tsteps_count(graph_name, r_type)
	results = [r for r in c]
	return json.dumps(results)

window.regionRGBMap = {
	'DAN': '239,83,80',		// Red
	'DMN': '255,167,38',	// Orange
	'FPN': '255,238,88',	// Yellow
	'LN': '102,187,106',	// Green
	'SMN': '66,165,245',	// Blue
	'VAN': '92,107,192',	// Indigo
	'VN': '171,71,188',		// Violet
	'': '189,189,189'		// Grey (empty string key denotes unlabeled node)
};

// Return string of RGB color mapping based on brain region of node
function getMappedColor(region) {
	var mappedRGB = window.regionRGBMap[region];
	return 'rgb(' + mappedRGB + ')';
}

// Update the sigma instance located in sigmaID with new dataURL source for graph
function updateSigma(dataURL, sigmaID) {
	$('#' + sigmaID).empty();
	var s = new sigma({
		container: sigmaID,
		renderer: {
			container: document.getElementById(sigmaID),
			type: 'canvas'
		},
		settings: {
			minNodeSize: 3,
			maxNodeSize: 6
		}
	});

	sigma.parsers.json(dataURL, s, function(s) {
		var allDegrees = s.graph.nodes().map(function(obj) {
			return s.graph.degree(obj.label);
		});
		var maxDegree = Math.max.apply(Math, allDegrees);

		s.graph.nodes().forEach(function(node, i, a) {
			// Initialize node's position to point along a circle
			node.x = Math.cos(Math.PI * 2 * i / a.length);
			node.y = Math.sin(Math.PI * 2 * i / a.length);

			// Update node's size and color based on its degree and brain region, respectively
			node.size = s.graph.degree(node.id);
			node.color = getMappedColor(node.region);
		});

		// Start the layout algorithm, then stop after specified timeout
		s.startForceAtlas2({slowDown: 10});
		setTimeout(function() {
			s.stopForceAtlas2();
		}, 1000);
	});
}

// Use mustache.js to update content in table located in tableTemplID with updated data from dataURL
// Update graph visualizations by using first structure at first time step in updated table
function updateTable(dataURL, tableTemplID, tableID, g, restState, sigmaID) {
	$.getJSON(dataURL, function(data) {
		var output = $('#' + tableID);
		var template = $('#' + tableTemplID).html()
		var updatedData = Mustache.render(template, {
			"strucs": data,
			toFixed: function() {
				return function(num, render) { return parseFloat(render(num)).toFixed(4); }
			}
		});
		$('#' + tableID + '-data').remove();
		$('#' + tableID).append(updatedData);

		if (g) {
			var $tstepButton = $('#' + tableID + ' .js--tstep-button').first()
			var tstepChoice = $tstepButton.text();
			var strucIndex = $tstepButton.parents('tr').index();
			updateSigma('api/traverse/' + g.subject + '_' + restState + '_' + g.thresh.toString().replace('.', '') +
				'_' + g.tstep + '?tstep=' + tstepChoice + '&struc=' + strucIndex, sigmaID);
		}
	});
}

// Return a single object containing currently selected values from dropdown menus
function getGraphParams() {
	return {
		'subject': $('#tc-input-subject').find('option:selected')[0].value,
		'thresh': $('#tc-input-thresh').find('option:selected')[0].value,
		'tstep': $('#tc-input-tstep').find('option:selected')[0].value
	};
}

// Replace the data URL of specPath located in specID to specURL
function updateEmbed(specPath, specURL, specID) {
	$.getJSON(specPath, function(spec) {
		spec.data[0].url = specURL;
		vega.embed(specID, spec);
	});
}

// Update charts, tables, and graph visualizations based on new dropdown menu selections
function tcInputListener() {
	var g = getGraphParams();

	var pref = 'data/' + g.subject + '/' + g.subject + '_Rest+' + g.thresh + '-' + g.tstep + '.json';
	var pref2 = 'data/' + g.subject + '/' + g.subject + '_MindfulRest+' + g.thresh + '-' + g.tstep + '.json';

	var specs = {
		0: 'api/timesteps/' + g.subject + '_R_' + g.thresh.toString().replace('.', '') + '_' + g.tstep,
		1: pref + '?type=struc_distr',
		2: pref + '?type=node_distr',
		3: pref2 + '?type=struc_distr',
		4: pref2 + '?type=node_distr'
	};

	for (var i = 0; i < 5; ++i) {
		updateEmbed('static/specs/spec_v' + i.toString() + '.json', specs[i], '#view' + i.toString());
	}

	updateTable(pref, 'tc-table-template', 'tc-table', g, 'R', 'graph-rest');
	updateTable(pref2, 'tc-table2-template', 'tc-table2', g, 'MR', 'graph-mindful-rest');
}

// Update graph visualizations based on content of clicked time step button
function tstepButtonListener() {
	var g = getGraphParams();
	var tstepChoice = this.innerHTML;
	var strucIndex = $(this).parents('tr').index();
	var restState = $(this).parents('table').is('#tc-table') ? 'R' : 'MR';
	var sigmaID = (restState === 'R') ? 'graph-rest' : 'graph-mindful-rest';
	updateSigma('api/traverse/' + g.subject + '_' + restState + '_' + g.thresh.toString().replace('.', '') +
				'_' + g.tstep + '?tstep=' + tstepChoice +'&struc=' + strucIndex, sigmaID);
}

$(function() {
	// Initialization of Vega charts
	for (var i = 0; i < 5; ++i) {
		vega.embed('#view' + i.toString(), 'static/specs/spec_v' + i.toString() + '.json');
	}

	// Initialization of graph visualizations
	updateSigma('api/traverse/MH01_R_030_12?tstep=2&struc=0', 'graph-rest');
	updateSigma('api/traverse/MH01_MR_030_12?tstep=2&struc=0', 'graph-mindful-rest');

	// Initialization of full TimeCrunch summary tables
	updateTable('data/MH01/MH01_Rest+0.30-12.json', 'tc-table-template', 'tc-table', '', '', '');
	updateTable('data/MH01/MH01_MindfulRest+0.30-12.json', 'tc-table2-template', 'tc-table2', '', '', '');

	// Listen for user selection from dropdown menus
	$('#tc-input-subject, #tc-input-thresh, #tc-input-tstep').change(tcInputListener);

	// Listen for user click of time step buttons
	$('#tc-table, #tc-table2').on('click', '.js--tstep-button', tstepButtonListener);
});

import $ from 'jquery';
import moment from 'moment';
import * as d3 from 'd3';
import * as d3s from 'd3-sankey';
import dialog from './dialog';
import { describeNode, getCauses } from './utils';
import { black } from './palette.json';
import audit from './audit';
import tip from './tip';
import investigation from './investigation';
import menu from './menu';
import { green, purple, blue, orange, pink, cyan, yellow, lightblack, red, turquois, navy, steel } from './palette.json';

var MARGIN = { top: 32, right: 140, bottom: 32, left: 2 };

const colors = {
	'bp-diastolic': pink,
	'bp-systolic': turquois,
	'caloric-burn': navy,
	'caloric-intake': yellow,
	'diagnosis': blue,
	'height': green,
	'hr': yellow,
	'inr': steel,
	'medicate': cyan,
	'prescription': purple,
	'procedure': orange,
	'satisfaction': green,
	'sleep': purple,
	'symptom-breathlessness': lightblack,
	'symptom-palpitations': red,
	'weight': blue,
};

const combineByType = (nodes, links = []) => {
	let types = {},
		newNodes = [];
	nodes.forEach(node => {
		if (!types[node.type]) { types[node.type] = []; }
		types[node.type].push(node);
	});
	Object.entries(types).forEach(([type, ds]) => {
		var newNode = {
			id: ds[0].id,
			date: ds[0].date,
			nodes: ds,
			type
		};
		newNode.value = Math.max(...ds.map(d => d.value));
		newNodes.push(newNode);

		ds.forEach(node => {
			links.forEach(l => {
				if (l.sourceNode === node) { l.sourceNode = newNode; }
				if (l.targetNode === node) { l.targetNode = newNode; }
			});
		});
		/*if (type === 'feel') { node.feel = _.min(_.map(ds, 'feel')); }
		if (type === 'activity') { node.effort = _.sum(_.map(ds, 'effort')); }
		if (type === 'symptom') {
			node.severity = _.max(_.map(ds, 'severity'));
			node.symptom = _.uniq(_.map(ds, 'symptom')).join('/');
		}
		if (type === 'med-compliance') { node.compliance = _.min(_.map(ds, 'compliance')); }
		if (type === 'cardio') { node.cardio = ds[0].cardio; }
		if (type === 'inr') { node.inr = ds[0].inr; }
		if (type === 'visit') { node.visit = _.uniq(_.map(ds, 'visit')).join('/'); }
		if (type === 'intervention') { node.intervention = _.uniq(_.map(ds, 'intervention')).join('/'); }*/
		return newNode;
	});
	return newNodes;
};

const sankeyData = (person, leaves) => {
	let combine = leaves.length > 1;
	if (combine) { leaves = combineByType(leaves); }
	let originalLeaves = leaves,
		nodes = [].concat(leaves),
		links = [];
	Array(2).fill(null).forEach((n, i) => {
		let newLeaves = [];
		leaves.forEach(leaf => {
			let leafNodes = leaf.nodes || [leaf];
			let causes = [].concat(...leafNodes.map(node => getCauses(person, node)));
			//let causes = getCauses(person, leaf);
			causes.forEach(([node, score]) => {
				if (!newLeaves.includes(node)) { newLeaves.push(node); }
				let link = links.find(l => l.sourceNode === node && l.targetNode === leaf);
				if (!link) {
					link = { sourceNode: node, targetNode: leaf, value: 0 };
					links.push(link);
				}
				link.value += score;
			});
		});

		if (combine) {
			newLeaves = combineByType(newLeaves, links);
		}

		newLeaves.forEach(node => {
			if (!nodes.includes(node)) { nodes.push(node); }
		});

		leaves = newLeaves;
	});

	links.forEach(l => {
		l.source = nodes.indexOf(l.sourceNode);
		l.target = nodes.indexOf(l.targetNode);
	});

	var leafIndices = originalLeaves
		.map(d => nodes.findIndex(n => n.id === d.id))
		.filter(i => i > -1);

	leafIndices = [...new Set(leafIndices)];

	var normaliseQueue = leafIndices,
		nodeIndex, sourceOf, sourceOfTotal, targetOf, targetOfTotal,
		limit = 10000;

	while (normaliseQueue.length > 0 && limit-- > 0) {
		nodeIndex = normaliseQueue.pop();
		sourceOf = links.filter(l => l.source === nodeIndex);
		sourceOfTotal = sourceOf.reduce((sum, d) => sum + d.value, 0) || 1;
		targetOf = links.filter(l => l.target === nodeIndex);
		targetOfTotal = targetOf.reduce((sum, d) => sum + d.value, 0) || 1;

		// normalise the value of each link pointing to this node
		targetOf.forEach(link => {
			link.value *= sourceOfTotal / targetOfTotal;
			if (normaliseQueue.indexOf(link.source) > -1) { normaliseQueue.splice(normaliseQueue.indexOf(link.source), 1); }
			normaliseQueue.push(link.source);
		});
	}

	return { nodes, links };
};

const renderSankey = (el, person, nodes_) => {
	let originalPerson = person;
	person = Object.assign({}, person);
	person.nodes = person.nodes.map(node => Object.assign({}, node));
	nodes_ = nodes_.map(node_ => person.nodes.find(n => n.id === node_.id));

	let data = sankeyData(person, nodes_);
	let original = d => originalPerson.nodes.find(n => n.id === d.id);

	let svg = d3.select(el)
		.attr('width', 680)
		.attr('height', 420)
		.append('g')
		.attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

	let width = 680 - MARGIN.left - MARGIN.right,
		height = 440 - MARGIN.top - MARGIN.bottom;

	/*let textLocations = [];

	let textY = (x, y) => {
		console.log('textY', x, y);
		var existing = textLocations.find(pos => Math.abs(x - pos.x) < 100 && Math.abs(y - pos.y) < 10);
		if (existing) { return textY(x, existing.y - 20); }
		textLocations.push({ x: x, y: y });
		return y;
	};*/

	d3s.sankey()
		.nodeWidth(4)
		.nodePadding(10)
		.extent([[30, 0], [width, height]])
		(data);

	svg.append('g')
		.attr('class', 'links')
		.selectAll('path')
		.data(data.links)
		.enter().append('path')
			.attr('stroke', d => colors[d.source.type])
			.attr('d', d3s.sankeyLinkHorizontal())
			.attr('stroke-width', d => Math.max(1, d.width))
			.on('mousemove', d => {
				let source = original(d.source),
					target = original(d.target),
					timeBetween = moment(source.date).from(target.date, true),
					percent = Math.round(d.value / d.target.value * 100),
					html = `<strong>${describeNode(person, source)}</strong> ${timeBetween} prior may have led to 
							<strong>${describeNode(person, target)}</strong>.
							<emph>${percent}% contributing factor</emph>.`;
				tip.renderCustom(d3.event.clientX, d3.event.clientY, html);
			})
			.on('mouseleave', () => tip.destroy());;

	let node = svg.append('g')
		.attr('class', 'nodes')
		.attr('font-family', 'sans-serif')
		.attr('font-size', 10)
		.selectAll('g')
			.data(data.nodes)
			.enter().append('g');

	node.append('rect')
		.attr('x', d => d.x0)
		.attr('y', d => d.y0)
		.attr('height', d => d.y1 - d.y0)
		.attr('width', d => d.x1 - d.x0)
		.attr('fill', d => colors[d.type])
		.attr('stroke', black)
		.on('click', d => {
			menu.render(d3.event.clientX, d3.event.clientY, [
				{ title: 'Investigate', click: () => investigation.render(person, [original(d)]) },
				{ title: 'Audit', click: () => audit.render(person, original(d)) },
			]);
		})
		.on('mousemove', d => tip.render(d3.event.clientX, d3.event.clientY, person, original(d)))
		.on('mouseleave', () => tip.destroy());

	node.append('text')
		.attr('x', d => d.x0 + 6)
		.attr('y', d => (d.y1 + d.y0) / 2)
		.attr('dy', '.35em')
		.attr('text-anchor', 'start')
		.text(d => describeNode(person, original(d)));
};

const render = (person, nodes) => {
	let $dlg = $($('.template-investigation').html());
	$dlg.find('.title').text(`Investigation of ${nodes.length} measurements`);
	$dlg.find('.close').on('click', () => $dlg.remove());
	$('body').append($dlg);
	dialog.create($dlg);
	renderSankey($dlg.find('svg.sankey')[0], person, nodes);
};

export default { render };
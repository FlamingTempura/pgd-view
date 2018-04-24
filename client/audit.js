/* jshint node: true, browser: true, esversion: 6 */
'use strict';
import $ from 'jquery';
import moment from 'moment';
import dialog from './dialog';
import menu from './menu';
import tip from './tip';
import investigation from './investigation';
import * as d3 from 'd3';
//const d3 = window.d3;

const days = 7;
const contextChart = (person, node) => {
	let element = document.createElementNS('http://www.w3.org/2000/svg', 'svg'),
		start = moment(node.date).subtract(days, 'day').valueOf(),
		end = moment(node.date).add(1, 'day').valueOf(),
		margin = { top: 8, right: 24, bottom: 30, left: 70 },
		width = 460 - margin.left - margin.right,
		height = 260 - margin.top - margin.bottom,
		data = person.nodes.filter(n => n.date.getTime() >= start && n.date.getTime() < end),
		g = d3.select(element)
			.attr('class', 'context-chart')
			.attr('width', width + margin.left + margin.right)
			.attr('height', height + margin.top + margin.bottom)
			.append('g')
				.attr('transform', `translate(${margin.left},${margin.top})`),
		x = d3.scaleTime().rangeRound([0, width]),
		y = d3.scaleBand().range([height, 0]),
		valueScales = {};

	person.types.forEach(type => {
		valueScales[type.id] = d3.scaleLinear()
			.range([3, 8])
			.domain(d3.extent(data.filter(d => d.type === type.id).map(d => d.value)));
	});

	x.domain([new Date(start), new Date(end)]);
	y.domain(person.types.map(t => t.id));

	g.selectAll('circle').data(data).enter().append('circle')
		.attr('class', d => d === node ? 'node active' : 'node')
		.attr('cx', d => x(d.date))
		.attr('cy', d => y(d.type))
		//.attr('r', d => valueScales[d.type](d.value))
		.attr('r', d => d === node ? 6 : 4)
		.on('click', d => menu.render(d3.event.clientX, d3.event.clientY, [
			{ title: 'Investigate', click: () => investigation.render(person, [d]) },
			{ title: 'Audit', click: () => render(person, d) },
		]))
		.on('mousemove', d => tip.render(d3.event.clientX, d3.event.clientY, person, d))
		.on('mouseleave', d => tip.destroy());

	g.append('g')
		.attr('class', 'x axis')
		.attr('transform', `translate(0,${height - 7})`)
		.call(d3.axisBottom(x)
			.ticks(days + 1)
			.tickFormat(d3.timeFormat("%d %b")));

	g.append('g')
		.attr('class', 'y axis')
		.call(d3.axisLeft(y));

	return element;
};

const render = (person, node) => {
	let $dlg = $($('.template-audit').html()),
		source = person.sources.find(s => s.id === node.source),
		type = person.types.find(t => t.id === node.type);
	$dlg.find('.title').text(`Audit: ${type.name} measurement (${source.name})`);
	$dlg.find('.date').text(moment(node.date).format('D MMM YYYY HH:mm:ss'));
	$dlg.find('.type').text(type.name);
	$dlg.find('.value').text(node.value);
	$dlg.find('.unit').text(type.unit)
		.prev().addBack().toggle(!!type.unit);
	$dlg.find('.description').text(type.description)
		.prev().addBack().toggle(!!type.description);
	$dlg.find('.source-name').text(source.name);
	$dlg.find('.source-measures').text(source.types.map(t => {
		let type = person.types.find(t_ => t_.id === t);
		return type.name + (type.unit ? ` (${type.unit})` : '');
	}).join(', '));
	$dlg.find('.source-precision').text(`${source.precision} decimal places`)
		.prev().addBack().toggle(!!source.hasOwnProperty('precision'));
	$dlg.find('.source-description').text(source.description)
		.prev().addBack().toggle(!!source.description);
	$dlg.find('.img').attr('href', `api/image/${source.name}.jpg`);
	$dlg.find('.img img').attr('src', `api/image/${source.name}.jpg`);
	$dlg.find('.reviewstitle').text(`Scholarly reviews of ${source.name}`);
	$dlg.find('.close').on('click', () => $dlg.remove());

	$.getJSON(`/api/pubmed/${source.reviewQuery}`).then(data => {
		data.results.forEach(r => {
			let date = new Date(r.published);
			$dlg.find('.reviews').append(`<a href="${r.url}" target="_blank">${r.authors.join(', ')} (${date.getFullYear()}). <em>${r.title}</em> ${r.journal}.</a>`);
		});
	});

	$dlg.find('.incontext').append(contextChart(person, node));
	$('body').append($dlg);

	dialog.create($dlg);
};

export default { render };
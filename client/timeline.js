/* jshint node: true, browser: true, esversion: 6 */
'use strict';

import $ from 'jquery';
import moment from 'moment';
import * as d3 from 'd3';
//const d3 = window.d3;
import audit from './audit';
import tip from './tip';
import investigation from './investigation';
import menu from './menu';
import dataexport from './dataexport';
import datumselect from './datumselect';
import { green, purple, blue, orange, pink, cyan, yellow, lightblack, red, turquois, navy, steel } from './palette.json';

const timeline = { };

const chartDefs = [
	{
		title: 'Symptom severity',
		series: [
			{ type: 'symptom-palpitations', color: red, title: 'Palpitations' },
			{ type: 'symptom-breathlessness', color: lightblack, title: 'Breathlessness' }
		],
		columns: true,
		dots: true,
		ticks: 5,
		tickFormat: 'd',
		legend: true
	},
	{
		title: 'Clinical visits',
		series: [
			{ type: 'diagnosis', color: blue, title: 'Diagnosis' },
			{ type: 'prescription', color: purple, title: 'Drug change' },
			{ type: 'procedure', color: orange, title: 'Procedure' }
		],
		dots: true,
		legend: true,
		min: -1,
		max: 1,
		stackdots: true,
		bin: 'week'
	},
	{
		title: 'Compliance',
		series: [{ type: 'medicate', color: cyan }],
		//line: true,
		trend: true,
		//dots: true
		columns: true,
		bin: 'day'
	},
	{
		title: 'Sleep (hours)',
		series: [{ type: 'sleep', color: purple }],
		//line: true,
		trend: true,
		//dots: true
		columns: true,
		bin: 'day'
	},
	{
		title: 'Calorie intake (kcal)',
		series: [{ type: 'caloric-intake', color: yellow }],
		//line: true,
		trend: true,
		//dots: true
		columns: true,
		bin: 'day'
	},
	{
		title: 'Calorie burn (kcal)',
		series: [{ type: 'caloric-burn', color: navy }],
		//line: true,
		trend: true,
		//dots: true
		columns: true,
		bin: 'day'
	},
	{
		title: 'Body weight (kg)',
		series: [{ type: 'weight', color: blue }],
		line: true,
		trend: true,
		dots: true
	},
	{
		title: 'Satisfaction',
		series: [{ type: 'satisfaction', color: green }],
		//line: true,
		trend: true,
		//dots: true
		columns: true
	},
	{
		title: 'Blood pressure',
		series: [
			{ type: 'bp-systolic', color: turquois, title: 'Systolic' },
			{ type: 'bp-diastolic', color: pink, title: 'Diastolic' }
		],
		line: true,
		trend: true,
		dots: true,
		legend: true
	},
	{
		title: 'Heart rate',
		series: [{ type: 'hr', color: yellow }],
		line: true,
		trend: true,
		dots: true
	},
	{
		title: 'INR',
		series: [{ type: 'inr', color: steel }],
		line: true,
		trend: true,
		dots: true
	}
];

const avg = arr => arr.reduce((avg, el) => avg + el / arr.length, 0);

let reset, start, end;

const visibleTypes = {};

const render = person => {
	if (reset) { reset(); }

	let topAxis = renderTimeAxis(true);
	let bottomAxis = renderTimeAxis();
	let rangeBar = renderRangeBar();

	$('.timeline').append(topAxis.element);
	
	let charts = chartDefs.map(options => {
		let chart = createChart(options),
			$show = $(`<label><input type="checkbox" checked> ${options.title}</label>`),
			$export = $(`<button class="export material-icons">file_download</button>`),
			$checkbox = $show.find('input');
		$checkbox.on('change', () => {
			chart.toggle($checkbox.is(':checked'));
			rangeBar.update(person, start, end, $('.timeline').innerWidth());
		});
		$($export).on('click', () => {
			dataexport.render(person, options.title, chart.data);
		});
		$('.timeline').append($export);
		$('.timeline').append(chart.element);
		$('.charts').append($show);
		$export.css('top', $(chart.element).offset().top);
		return { chart };
	});
	$('.timeline').append(bottomAxis.element);
	$('.timeline').append(rangeBar.element);
	let lastArgs = [];
	let update = (updateRangeBar = true) => {
		let width = $('.timeline').innerWidth();
		if (timeline.zoom !== lastArgs.zoom) {
			start = timeline.zoom ? new Date(end.getTime() - timeline.zoom) : person.nodes[0].date;
		}
		if (start !== lastArgs.start || end !== lastArgs.end || width !== lastArgs.width) {
			charts.forEach(({ chart }) => {
				chart.update(person, start, end, width);
			});
			topAxis.update(person, start, end, width);
			bottomAxis.update(person, start, end, width);
			if (updateRangeBar) { rangeBar.update(person, start, end, width); }
		}
		lastArgs = { start, end, width, zoom: timeline.zoom };
	};
	timeline.update = update;

	start = person.nodes[0].date;
	end = person.nodes[person.nodes.length -1].date;

	$('.rangestart, .rangeend').on('input', update);
	$(window).on('resize', update);
	setTimeout(update);
	reset = () => {
		$('.charts, .timeline, .exports').html('');
		$('.rangestart, .rangeend').off('input', update);
	};
};

const margin = { top: 4, right: 20, bottom: 4, left: 120 };

const renderTimeAxis = (top) => {
	let element = document.createElementNS('http://www.w3.org/2000/svg', 'svg'),
		svg = d3.select(element)
			.attr('class', 'axis ' + (top ? 'top' : 'bottom'))
			.attr('height', 26),
		g = svg.append('g')
			.attr('transform', `translate(${margin.left},${top ? 20 : 0})`),
		x = d3.scaleTime(),
		xAxis = g.append('g').attr('class', 'x axis');
	let update = (person, start, end, width) => {
		svg.attr('width', width);
		width -= margin.left + margin.right;
		x.domain([start, end]).rangeRound([0, width]);
		let fn = top ? d3.axisTop(x) : d3.axisBottom(x);
		xAxis.call(fn);
	};
	return { element, update };
};

const renderRangeBar = () => {
	let element = document.createElementNS('http://www.w3.org/2000/svg', 'svg'),
		height = 60,
		marginBottom = 20,
		svg = d3.select(element)
			.attr('class', 'rangebar')
			.attr('height', height),
		g = svg.append('g')
			.attr('transform', `translate(${margin.left},0)`),
		x = d3.scaleTime(),
		y = d3.scaleLinear().rangeRound([height - marginBottom, 0]),
		xAxis = g.append('g')
			.attr('class', 'x axis')
			.attr('transform', `translate(0,${height - marginBottom})`),
		histogram = g.append('g'),
		dragOffset,
		range = svg.append('rect')
			.attr('class', 'range')
			.attr('y', 0)
			.attr('height', height - marginBottom)
			.call(d3.drag()
				.on('start', () => {
					dragOffset = d3.event.x - range.attr('x');
				})
				.on('drag', () => {
					let rectX = d3.event.x - dragOffset,
						rectW = range.attr('width');
					range.attr('x', rectX);
					start = x.invert(rectX - margin.left);
					end = x.invert(Number(rectX) + Number(rectW) - margin.left);
					console.log(start, end);
					timeline.update(false);
				}));
	let update = (person, rangestart, rangeend, width) => {
		let start = person.nodes[0].date,
			end = person.nodes[person.nodes.length -1].date,
			bin = 'day',
			visibleNodes = person.nodes.filter(node => visibleTypes[node.type]),
			nodes = visibleNodes.filter(({date}) => date.getTime() >= start.getTime() && date.getTime() < end.getTime()),
			date = moment(nodes[0].date).startOf(bin).toDate(),
			dangerData = visibleNodes.filter(n => n.ranges && n.ranges.danger),
			data = [];

		while (date < end) {
			data.push({ date, count: 0 });
			date = moment(date).add(1, bin).toDate();
		}

		visibleNodes.forEach(node => {
			let date = moment(node.date).startOf(bin).toDate(),
				d = data.find(d => d.date.getTime() === date.getTime());
			d.count++;
		});

		svg.attr('width', width);
		width -= margin.left + margin.right;
		x.domain([start, end]).rangeRound([0, width]);
		y.domain(d3.extent(data, d => d.count));
		xAxis.call(d3.axisBottom(x));

		let rects = histogram.selectAll('.bar').data(data);
		rects.exit().remove();
		rects.enter().append('rect')
			.attr('class', 'bar');
		histogram.selectAll('.bar')
			.attr('x', d => Math.floor(x(d.date)))
			.attr('y', d => y(d.count))
			.attr('width', Math.ceil(x(moment().add(1, bin).toDate()) - x(new Date())))
			.attr('height', d => height - y(d.count) - marginBottom)
			.attr('fill', green);
		
		let hotspots = histogram.selectAll('.hotspot').data(data);
		hotspots.exit().remove();
		hotspots.enter().append('rect')
			.attr('class', 'hotspot')
			.attr('y', 0)
			.attr('height', height)
			.on('mousemove', d => tip.renderCustom(d3.event.clientX, d3.event.clientY, `${moment(d.date).format('D MMM YYYY')}<br>${d.count} entries`)) // 'wo [week of] YYYY'
			.on('mouseleave', d => tip.destroy());
		histogram.selectAll('.hotspot')
			.attr('x', d => Math.floor(x(d.date)))
			.attr('width', Math.ceil(x(moment().add(1, bin).toDate()) - x(new Date())))
			.attr('fill', 'transparent');

		let dangers = histogram.selectAll('.danger').data(dangerData);
		dangers.exit().remove();
		dangers.enter().append('rect')
			.attr('class', 'danger')
			.attr('width', 8)
			.attr('height', 8);
		histogram.selectAll('.danger')
			.attr('transform', d => `translate(${x(d.date)}, 0) rotate(45)`);

		range
			.attr('x', margin.left + x(rangestart))
			.attr('width', x(rangeend) - x(rangestart));
		
	};
	return { element, update };
};

const createChart = options => {
	let chart = {},
		element = document.createElementNS('http://www.w3.org/2000/svg', 'svg'),
		height = 60,
		svg = d3.select(element)
			.attr('class', 'chart')
			.attr('height', height + margin.top + margin.bottom),
		g = svg.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`),
		x = d3.scaleTime(),
		y = d3.scaleLinear().rangeRound([height, 0]),
		line = d3.line()
			.x(d => x(d.date))
			.y(d => y(d.value)),
		series = [].concat(options.series), // make sure it's an array
		legend = g.append('g'),
		subgroups = series.map((s, i) => {
			let group = g.append('g').attr('class', `series`);
			if (options.legend) {
				legend.append('circle')
					.attr('r', 3)
					.attr('cx', -margin.left + 10)
					.attr('cy', 23 + i * 14)
					.attr('fill', s.color);
				legend.append('text')
					.attr('y', 26 + i * 14)
					.attr('x', -margin.left + 20)
					.text(s.title);
			}
			return {
				line: group.append('path')
						.attr('class', 'line')
						.attr('stroke', s.color),
				columns: group.append('g')
						.attr('class', 'columns')
						.attr('fill', s.color),
				dots: group.append('g')
						.attr('class', 'dots')
						.attr('fill', s.color),
				hotspots: group.append('g').attr('class', 'hotspots'),
				trend: group.append('path').attr('class', 'trend'),
				dangers: group.append('g')
						.attr('class', 'dangers')
			};
		}),
		yAxis = g.append('g').attr('class', 'y axis');

	yAxis.append('text')
		.attr('y', 10)
		.attr('x', -margin.left + 3)
		.attr('text-anchor', 'start')
		//.attr('transform', 'rotate(-90)')
		.text(options.title);

	let update = (person, start, end, width) => {
		let nodes = person.nodes.filter(({date}) => date >= start && date < end),
			datasets = series.map(s => nodes.filter(node => node.type === s.type)),
			datasetsUnfiltered = series.map(s => person.nodes.filter(node => node.type === s.type));

		let click = d => {
			if (datumselect.isSelecting) {
				datumselect.select(d.originalNode || d);
			} else {
				menu.render(d3.event.clientX, d3.event.clientY, [
					{ title: 'Investigate', click: () => investigation.render(person, [d.originalNode || d]) },
					{ title: 'Audit', click: () => audit.render(person, d.originalNode || d) },
				]);
			}
		};

		let mousemove = d => {
			if (datumselect.isSelecting) {
				datumselect.hover(d.originalNode || d);
			} else {
				tip.render(d3.event.clientX, d3.event.clientY, person, d.originalNode || d);
			}
		};

		let mouseleave = () => {
			if (datumselect.isSelecting) {
				datumselect.hover();
			} else {
				tip.destroy();
			}
		};

		svg.attr('width', width);
		width -= margin.left + margin.right;
		let min = d3.min(series, (s, i) => {
			let type = person.types.find(t => t.id === s.type),
				m = d3.min(datasetsUnfiltered[i], d => d.value) * 0.9;
			return type && type.thresholds && type.thresholds.hasOwnProperty('min') ?
				Math.max(m, type.thresholds.min) : m;
		});
		let max = d3.max(series, (s, i) => {
			let type = person.types.find(t => t.id === s.type),
				m = d3.max(datasetsUnfiltered[i], d => d.value) * 1.1;
			return type && type.thresholds && type.thresholds.hasOwnProperty('max') ?
				Math.min(m, type.thresholds.max) : m;
		});
		x.domain([start, end]).rangeRound([0, width]);
		y.domain([min, max]);
		chart.data = nodes; // so that it can be easily exported
		if (options.bin) {
			let bins = [];
			datasets = datasets.map(data => {
				return data.map(node => {
					let binDate = moment(node.date).startOf(options.bin).toDate().getTime();
					let bin = bins.find(b => b.date === binDate);
					if (!bin) {
						bin = { date: binDate, rows: [] };
						bins.push(bin);
					}
					let d = {
						date: new Date(binDate),
						originalDate: node.date,
						originalNode: node,
						value: node.value,
						type: node.node,
						bin,
						binIndex: bin.rows.length
					};
					bin.rows.push(d);
					return d;
				});
			});
		}
		datasets.forEach((data, i) => {
			let subgroup = subgroups[i],
				vals = data.map(d => d.value),
				avgSample = 12,
				runningAvg = data.map((d, i) => {
					let start = Math.round(i - avgSample / 2),
						end = Math.round(i + avgSample / 2);
					if (start < 0) {
						end -= start;
						start -= start;
					}
					if (end > vals.length) {
						start -= vals.length - end;
						end -= vals.length - end;
					}
					return {
						date: d.date,
						value: avg(vals.slice(start, end))
					};
				}),
				dangerData = data.filter(d => d.ranges && d.ranges.danger);
			if (options.line) { subgroup.line.datum(data).attr('d', line); }
			if (options.trend) { subgroup.trend.datum(runningAvg).attr('d', line); }
			if (options.dots) {
				let dots = subgroup.dots.selectAll('circle').data(data);
				dots.exit().remove();
				dots.enter().append('circle')
					.attr('r', 3);
				subgroup.dots.selectAll('circle')
					.attr('cx', d => x(d.date))
					.attr('cy', d => {
						if (options.stackdots) {
							return height / 2 - d.bin.rows.length / 2 * 7 + d.binIndex * 7;
						} else {
							return y(d.value);
						}
					});

				let hotspots = subgroup.hotspots.selectAll('circle').data(data);
				hotspots.exit().remove();
				hotspots.enter().append('circle')
					.attr('r', 5)
					.on('click', click)
					.on('mousemove', mousemove)
					.on('mouseleave', mouseleave);
				subgroup.hotspots.selectAll('circle')
					.attr('cx', d => x(d.date))
					.attr('cy', d => {
						if (options.stackdots) {
							return height / 2 - d.bin.rows.length / 2 * 7 + d.binIndex * 7;
						} else {
							return y(d.value);
						}
					});
			}
			if (options.columns) {
				let columns = subgroup.columns.selectAll('rect').data(data);
				columns.exit().remove();
				columns.enter().append('rect')
					.on('click', click)
					.on('mousemove', mousemove)
					.on('mouseleave', mouseleave);
				subgroup.columns.selectAll('rect')
					.attr('x', d => x(d.date) - 1)
					.attr('y', d => y(d.value))
					.attr('width', options.bin ? x(moment().add(1, options.bin).toDate()) - x(new Date()) : 2)
					.attr('height', d => height - y(d.value) + margin.bottom);
			}

			let dangers = subgroup.dangers.selectAll('rect').data(dangerData);
			dangers.exit().remove();
			dangers.enter().append('rect')
				.attr('width', 8)
				.attr('height', 8)
				.on('click', click)
				.on('mousemove', mousemove)
				.on('mouseleave', mouseleave);
			subgroup.dangers.selectAll('rect')
				.attr('transform', d => `translate(${x(d.date - 4)}, ${y(d.value) - 4}) rotate(45)`);
		});

		//yAxis.call(d3.axisLeft(y)
		//	.tickFormat(d3.format(options.tickFormat || '.1f'))
		//	.ticks(options.ticks));
	};

	let toggle = show => {
		svg.style('display', show ? 'block' : 'none');
		options.series.map(s => visibleTypes[s.type] = show);
	};
	toggle(true);

	return Object.assign(chart, { element, update, toggle });
};

export default Object.assign(timeline, { render });
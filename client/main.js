/* jshint node: true, browser: true, esversion: 6 */
'use strict';
import $ from 'jquery';
import moment from 'moment';
import profile from './profile';
import timeline from './timeline';
import dataselect from './dataselect';
import datumselect from './datumselect';
import dataexport from './dataexport';
import menu from './menu';
import { version } from '../package.json';
import { inRange } from './utils';

if (window.overrideAjax) { window.overrideAjax($); } // for building offline version

let currentPerson;

const go = url => {
	location.hash = url;
};

const showPatientSelect = () => {
	$('.dashboard').hide();
	$('.people').show().find('.links').html('');
	$.getJSON('/api/person').then(people => people.forEach(person => {
		let $link = $(`<div class="link">${person.firstName} ${person.lastName}</div>`);
		$link.on('click', () => go(`/person/${person.id}`));
		$('.people .links').append($link);
		$('head > title').text(`Patient-Generated Data`);
	}));
};

const showPatient = id => {
	$('.dashboard').show();
	$('.people').hide();
	$.getJSON(`/api/person/${id}`).then(person => {
		currentPerson = person;
		person.birthdate = new Date(person.birthdate);
		person.age = moment().diff(person.birthdate, 'years');
		person.nodes.forEach((node, i) => {
			node.id = i;
			node.date = new Date(node.date);
			node.value = Number(node.value);
			node.ranges = {};
			let type = person.types.find(t => t.id === node.type);
			Object.entries(type.ranges || {}).map(([id, criteria]) => {
				node.ranges[id] = inRange(criteria, node.value);
			});
			if (isNaN(node.value)) { node.value = 1; }
		});
		profile.render(person);
		timeline.render(person);
		$('head > title').text(`${person.firstName} ${person.lastName} - Patient-Generated Data`);
	});
};

const urlchange = () => {
	let match = location.hash.match(/^#\/person\/(.*)$/i);
	if (!match) {
		showPatientSelect();
	} else {
		showPatient(match[1]);
	}
};

$('.debug').click(() => {
	let x = $('.debug').offset().left,
		y = $('.debug').offset().top + $('.debug').outerHeight();
	menu.render(x, y, [
		{
			title: 'Regenerate person',
			click: () => {
				$.ajax({ method: 'PUT', url: `/api/person/${currentPerson.id}` })
					.then(() => showPatient(currentPerson.id));
			}
		},
		{ title: 'Version: ' + currentPerson.version }
	]);
});
$('.generateperson').click(() => {
	$.post('/api/person').then(showPatientSelect);
});
$('.version').text(`Developed by Peter West. Version ${version}`);
$('.selectpatient').click(() => go('/'));
$('.print').click(() => window.print());
$('.selectcharts').click(e => {
	if ($('.charts').css('display') !== 'block') {
		$('.charts').css({
			display: 'block',
			top: $('.selectcharts').position().top + $('.selectcharts').outerHeight() + 'px',
			left: $('.selectcharts').position().left + 'px'
		});
		$('body').one('click', () => $('.charts').css('display', 'none'));
		e.stopPropagation();
	}
});
$('.charts').click(e => e.stopPropagation());
$('.selectexport').click(() => {
	let x = $('.selectexport').position().left,
		y = $('.selectexport').position().top + $('.selectexport').outerHeight();
	menu.render(x, y, [
		{ title: 'Custom export', click: () => dataselect.render('export', currentPerson) },
		...currentPerson.types.map(t => ({
			title: t.name,
			click: () => dataexport.render(currentPerson, t.name, currentPerson.nodes.filter(d => d.type === t.id))
		}))
	]);
});

$('.startaudit').click(() => datumselect.render('audit', currentPerson));
$('.startinvestigation').click(() => dataselect.render('investigation', currentPerson));

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

[['1d', DAY], ['5d', 5 * DAY], ['1m', MONTH], ['3m', 3 * MONTH], ['6m', 6 * MONTH], ['1y', YEAR],['2y', 2 * YEAR], ['all']]
	.forEach(([name, zoom]) => {
		let $btn = $(`<button>${name}</button>`);
		$('.zooms').append($btn);
		$btn.click(() => {
			timeline.zoom = zoom;
			timeline.update();
		});
	});

$(() => {
	$('.loading').hide();
	urlchange();
});
$(window).on('popstate', urlchange);
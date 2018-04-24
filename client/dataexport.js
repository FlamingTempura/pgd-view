/* jshint node: true, browser: true, esversion: 6 */
'use strict';
import $ from 'jquery';
import moment from 'moment';
import dialog from './dialog';

const render = (person, title, data) => {
	let $dlg = $($('.template-dataexport').html());
	$dlg.find('.title').text(title);
	let $head = $('<tr>').appendTo($dlg.find('table thead'));
	let $tbody = $dlg.find('table tbody');
	let keys = ['date'];
	data = data
		.sort((a, b) => a.date.getTime() - b.date.getTime())
		.map(d => {
			d = Object.assign({}, d);
			d.date = moment(d.date).format('YYYY-MM-DD HH:mm:ss');
			Object.keys(d).forEach(k => {
				if (!keys.includes(k) && k !== 'type') { keys.push(k); }
			});
			return d;
		});

	keys.forEach(k => $head.append(`<th>${k}</th>`));

	data.forEach(d => {
		let $row = $('<tr>').appendTo($tbody);
		keys.forEach(k => {
			$row.append(`<td>${d[k]}</td>`);
		});
	});

	$dlg.find('.download').on('click', () => {
		let csv = keys.join(',') + '\r\n' +
			data.map(d => keys.map(k => d[k]).join(',')).join('\e\n');
		let blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
			url = URL.createObjectURL(blob),
			link = document.createElement('a');
		link.setAttribute('href', url);
		link.setAttribute('download', `${person.lastName}-${title}.csv`);
		link.style.visibility = 'hidden';
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	});
	
	$dlg.find('.close').on('click', () => $dlg.remove());
	$('body').append($dlg);
	dialog.create($dlg);
};

export default { render };
/* jshint node: true, browser: true, esversion: 6 */
'use strict';
import $ from 'jquery';
import dialog from './dialog';
import menu from './menu';
import investigation from './investigation';
import dataexport from './dataexport';
import datumselect from './datumselect';
import { describeNodeDetailed, inRange } from './utils';

const render = (mode, person) => {
	let $dlg = $($('.template-dataselect').html());
	$dlg.find('.mode').text(mode);
	
	let selected = [];

	let filters = [];
	person.types.forEach(type => {
		filters.push({
			title: type.name,
			filter: d => d.type === type.id
		});
		Object.entries(type.ranges || {}).forEach(([name, range]) => {
			filters.push({
				title: `${type.name} (${name})`,
				filter: d => d.type === type.id && inRange(range, d.value)
			});
		});
	});

	$dlg.find('.addquery').click(() => {
		let x = $('.addquery').position().left;
		let y = $('.addquery').position().top + $('.addquery').outerHeight();
		menu.render(x, y, filters.map(({ title, filter }) => ({
			title,
			click: () => {
				let nodes = person.nodes.filter(filter),
					item = { type: 'query', title, filter, nodes },
					$item = $('<li>'),
					$delete = $('<button class="delete"><i class="material-icons">close</i></remove>');
				$item.append(`Query: ${title} (${nodes.length} rows)`, $delete);
				$dlg.find('.list').append($item);
				selected.push(item);
				$delete.click(() => {
					selected.splice(selected.indexOf(item), 1);
					$item.remove();
				});
			}
		})), 'queries');
	});

	$dlg.find('.adddatapoint').click(() => {
		datumselect.render(null, person)
			.then(node => {
				let item = { type: 'node', title: describeNodeDetailed(person, node), node },
					$item = $('<li>'),
					$delete = $('<button class="delete"><i class="material-icons">close</i></remove>');
				$item.append(`Node: ${item.title}`, $delete);
				$dlg.find('.list').append($item);
				selected.push(item);
				$delete.click(() => {
					selected.splice(selected.indexOf(item), 1);
					$item.remove();
				});
			});
	});

	$dlg.find('.start').click(() => {
		let nodes = [].concat(...selected.map(s => s.nodes || s.node));
		nodes = [...new Set(nodes)]; // remove dupes
		console.log(nodes);
		if (mode === 'investigation') {
			investigation.render(person, nodes);
		}
		if (mode === 'export') {
			dataexport.render(person, 'custom export', nodes);
		}
	});

	$('body').append($dlg);

	$dlg.find('.close').on('click', () => $dlg.remove());
	dialog.create($dlg);
};

export default { render };
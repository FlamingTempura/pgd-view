/* jshint node: true, browser: true, esversion: 6 */
'use strict';
import $ from 'jquery';
import dialog from './dialog';
import audit from './audit';
import Bluebird from 'bluebird';
import { describeNodeDetailed } from './utils';

const datumselect = {};

const render = (mode, person) => {
	return new Bluebird(resolve => {
		let $dlg = $($('.template-datumselect').html());
		$('body').append($dlg);
		datumselect.isSelecting = true;
		const close = () => {
			datumselect.isSelecting = false;
			$dlg.remove();
		};

		datumselect.select = d => {
			if (mode === 'audit') {
				audit.render(person, d);
			}
			close();
			resolve(d);
		};
		datumselect.hover = d => {
			if (d) {
				$dlg.find('.datum').html(describeNodeDetailed(person, d));
			} else {
				$dlg.find('.datum').html('');
			}
		};

		$dlg.find('.close').on('click', close);
		dialog.create($dlg);
	});
};

export default Object.assign(datumselect, { render });
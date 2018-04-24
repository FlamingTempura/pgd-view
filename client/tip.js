/* jshint node: true, esversion: 6 */
'use strict';
import $ from 'jquery';
import { describeNodeDetailed } from './utils';

const $tip = $('.tip');

const render = (x, y, person, d) => {
	renderCustom(x, y, describeNodeDetailed(person, d));
};

const renderCustom = (x, y, html) => {
	x = Math.min(x, window.innerWidth - 180);
	y = Math.min(y, window.innerHeight - 60);
	$tip.html(html)
		.css({ left: `${x + 8}px`, top: `${y + 8}px` })
		.show();
};

const destroy = () => {
	$tip.hide();
};

export default { render, renderCustom, destroy };
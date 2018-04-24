/* jshint node: true, esversion: 6 */
'use strict';
import $ from 'jquery';

const render = (x, y, items, classname) => {
	let $menu = $($('.template-menu').html()).addClass(classname);
	items.forEach(item => {
		let $item = $(`<div>${item.title}</div>`);
		$item.on('click', item.click);
		$menu.append($item);
	});
	x = Math.min(x, window.innerWidth - 160);
	$menu.css({ left: `${x}px`, top: `${y}px` });
	$('body').append($menu);
	setTimeout(() => $('body').on('click', () => $menu.remove()));
};

export default { render };
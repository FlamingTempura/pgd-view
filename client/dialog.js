/* jshint node: true, browser: true, esversion: 6 */
'use strict';

import $ from 'jquery';

let dialogCount = 0;

const create = ($dlg) => {
	let startScreenX, startScreenY, startPosX, startPosY, dragging;
	dialogCount++;
	if (dialogCount > 10) { dialogCount = 1; }
	$dlg.css({ left: dialogCount * 20, top: dialogCount * 20 });
	const focus = () => {
		$('.dialog').each(function () { $(this).removeClass('focus').css({ zIndex: $(this).css('z-index') - 1 }); });
		$dlg.addClass('focus').css({ zIndex: 1000 });
	};
	$dlg.on('mousedown', focus);
	let $titlebar  = $dlg.find('.titlebar')[0],
		$title  = $dlg.find('.title')[0];
	$('body')
		.on('mousedown', e => {
			if (e.target === $title || e.target === $titlebar) {
				startScreenX = e.screenX;
				startScreenY = e.screenY;
				startPosX = Number($dlg.css('left').slice(0, -2));
				startPosY = Number($dlg.css('top').slice(0, -2));
				dragging = true;
			}
		})
		.on('mousemove', e => {
			if (!dragging) { return; }
			$dlg.css({
				left: Math.min($(window).innerWidth() - $dlg.outerWidth(), Math.max(0, startPosX + e.screenX - startScreenX)),
				top: Math.min($(window).innerHeight() - $dlg.outerHeight(), Math.max(0, startPosY + e.screenY - startScreenY))
			});
			e.preventDefault();
			e.stopPropagation();
		})
		.on('mouseup', e => {
			dragging = false;
		});

	setTimeout(focus);
};

export default { create };
		
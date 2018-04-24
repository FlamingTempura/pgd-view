/* jshint node: true, esversion: 6 */
'use strict';

import $ from 'jquery';
import moment from 'moment';

const render = person => {
	['firstName', 'lastName', 'sex', 'age', 'bloodType', 'version'].forEach(field => $(`.${field}`).text(person[field]));
	$('.birthdate').text(moment(person.birthdate).format('DD MMM YYYY'));
	['normalHeight', 'normalWeight'].forEach(field => {
		let type = person.types.find(t => t.id === field.slice(6).toLowerCase());
		$(`.${field}`).text(type.thresholds.normal + type.unit);
	});
};

export default { render };
import moment from 'moment';

const DAY = 24 * 60 * 60 * 1000;

const describeNode = (person, d) => {
	let type = person.types.find(t => t.id === d.type);
	return `${d.value} ${type.unit || ''} (${type.name.toLowerCase()})`;
};

const describeNodeDetailed = (person, d) => {
	let type = person.types.find(t => t.id === d.type),
		date = moment(d.originalDate || d.date).format('D MMM YYYY HH:mm:ss');
	return `${date} <br> <strong>${d.value} ${type.unit || ''} (${type.name.toLowerCase()})</strong>`;
};

const priorEntries = (person, node, filter, timeLimit, scoreMultiplier = 1) => {
	let t1 = node.date.getTime();
	return person.nodes
		.filter(d => {
			let t2 = d.date.getTime();
			return d !== node && t2 < t1 && t1 - t2 < timeLimit && filter(d);
		})
		.slice(-3)// limit to 3
		.map(d => {
			var daysAgo = (t1 - d.date.getTime()) / DAY,
				timeFactor =  -Math.pow(1 / 30 * daysAgo, 2) + 1;
			return [d, (d.score || 1) * scoreMultiplier * timeFactor];
		});
};

const typeAssociations = [
	{
		type: 'weight',
		associatedWith: [['medicate', 2 * DAY, 0.5], ['caloric-intake', 2 * DAY, 0.9], ['caloric-burn', 2 * DAY, 1]]
	},
	{
		type: 'sleep',
		associatedWith: [['medicate', 2 * DAY, 0.5], ['satisfaction', 2 * DAY, 0.9]]
	},
	{
		type: 'satisfaction',
		associatedWith: [['medicate', 2 * DAY, 0.5], ['sleep', 2 * DAY, 0.9], ['caloric-burn', 2 * DAY, 1], ['caloric-intake', 2 * DAY, 0.9]]
	},
	{
		type: 'procedure',
		associatedWith: [['medicate', 2 * DAY, 0.5], ['hr', 2 * DAY, 0.9], ['symptom-palpitations', 2 * DAY, 1], ['bp-diastolic', 2 * DAY, 1], ['bp-systolic', 2 * DAY, 1]]
	},
	{
		type: 'prescription',
		associatedWith: [['medicate', 2 * DAY, 0.5], ['hr', 2 * DAY, 0.9], ['symptom-palpitations', 2 * DAY, 1], ['bp-diastolic', 2 * DAY, 1], ['bp-systolic', 2 * DAY, 1]]
	},
	{
		type: 'symptom-palpitations',
		associatedWith: [['medicate', 2 * DAY, 0.5], ['hr', 2 * DAY, 0.9], ['bp-diastolic', 2 * DAY, 1], ['bp-systolic', 2 * DAY, 1], ['caloric-burn', 2 * DAY, 1]]
	},
	{
		type: 'medicate',
		associatedWith: [['hr', 2 * DAY, 0.5], ['satisfaction', 2 * DAY, 0.9], ['bp-diastolic', 2 * DAY, 1], ['bp-systolic', 2 * DAY, 1]]
	},
	{
		type: 'inr',
		associatedWith: [['medicate', 2 * DAY, 0.5], ['hr', 2 * DAY, 0.9], ['bp-diastolic', 2 * DAY, 1], ['bp-systolic', 2 * DAY, 1], ['caloric-burn', 2 * DAY, 1]]
	},
	{
		type: 'height',
		associatedWith: []
	},
	{
		type: 'hr',
		associatedWith: [['medicate', 2 * DAY, 0.5], ['symptom-palpitations', 2 * DAY, 0.9], ['bp-diastolic', 2 * DAY, 1], ['bp-systolic', 2 * DAY, 1], ['caloric-burn', 2 * DAY, 1]]
	},
	{
		type: 'diagnosis',
		associatedWith: [['medicate', 2 * DAY, 0.5], ['symptom-palpitations', 2 * DAY, 0.9], ['bp-diastolic', 2 * DAY, 1], ['bp-systolic', 2 * DAY, 1], ['hr', 2 * DAY, 1]]
	},
	{
		type: 'caloric-intake',
		associatedWith: [['medicate', 2 * DAY, 0.5], ['satisfaction', 2 * DAY, 0.9]]
	},
	{
		type: 'caloric-burn',
		associatedWith: [['medicate', 2 * DAY, 0.5], ['satisfaction', 2 * DAY, 1]]
	},
	{
		type: 'symptom-breathlessness',
		associatedWith: [['medicate', 2 * DAY, 0.5], ['hr', 2 * DAY, 0.9], ['bp-diastolic', 2 * DAY, 1], ['bp-systolic', 2 * DAY, 1], ['caloric-burn', 2 * DAY, 1]]
	},
	{
		type: 'bp-systolic',
		associatedWith: [['medicate', 2 * DAY, 0.5], ['hr', 2 * DAY, 0.9], ['bp-diastolic', 2 * DAY, 1], ['symptom-palpitations', 2 * DAY, 1], ['caloric-burn', 2 * DAY, 1]]
	},
	{
		type: 'bp-diastolic',
		associatedWith: [['medicate', 2 * DAY, 0.5], ['hr', 2 * DAY, 0.9], ['symptom-palpitations', 2 * DAY, 1], ['bp-systolic', 2 * DAY, 1], ['caloric-burn', 2 * DAY, 1]]
	}
];

const getCauses = (person, node) => {
	let causes = [],
		type = typeAssociations.find(a => a.type === node.type) || { associatedWith: [] };
	type.associatedWith.forEach(([type, time, score]) => {
		priorEntries(person, node, d => d.type === type, time, score)
			.forEach(parent => causes.push(parent));
	});
	return causes;
};

const inRange = (range, value) => {
	if (range instanceof Array) {
		return range.find(r => inRange(r, value));
	} else {
		let entries = Object.entries(range);
		let result = entries.filter(([operator, val]) => {
			if (operator === 'eq') { return value === val; }
			if (operator === 'lt') { return value < val; }
			if (operator === 'lte') { return value <= val; }
			if (operator === 'gt') { return value > val; }
			if (operator === 'gte') { return value >= val; }
		});
		return result.length === entries.length;
	}
};

export { describeNode, getCauses, describeNodeDetailed, inRange };
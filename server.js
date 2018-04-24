/* jshint node: true, esversion: 6 */
'use strict';

const Bluebird = require('bluebird');
const fs = Bluebird.promisifyAll(require('fs'));
const express = require('express');
const bodyParser = require('body-parser');
const rollup = require('rollup');
const resolve = require('rollup-plugin-node-resolve');
const commonjs = require('rollup-plugin-commonjs');
const json = require('rollup-plugin-json');
const less = require('less');
const request_ = require('request-promise');
const moment = require('moment');
const app = express();
const mhealthgen = require('/home/peter/mhealthgen/mhealthgen.js');

if (!fs.existsSync('cache')) { fs.mkdirSync('cache'); }
if (!fs.existsSync('people')) { fs.mkdirSync('people'); }

const cachepath = (method, url, data = '') => {
	data = JSON.stringify(data);
	return 'cache/' + `${method}-${url}-${data}`.toLowerCase().replace(/[^a-z0-9]/gi, '_');
};

const request = ({ url, data, headers, method = 'GET', json = true, cache = true }) => {
	return (
		cache ? 
			fs.readFileAsync(cachepath(method, url, data)):
			Bluebird.reject()
		)
		.catch(() => {
			let req = request_({
				method, url, headers,
				form: data,
				followAllRedirects: true,
				timeout: 5000
			});
			if (cache) {
				let ws = fs.createWriteStream(cachepath(method, url, data));
				req.pipe(ws);
			}
			return req;
		})
		.then(body => json ? JSON.parse(body) : body);
};

app.set('json spaces', 2);
app.use(bodyParser.json());

app.use('/MaterialIcons-Regular.eot', express.static('./node_modules/material-design-icons/iconfont/MaterialIcons-Regular.eot'));
app.use('/MaterialIcons-Regular.ijmap', express.static('./node_modules/material-design-icons/iconfont/MaterialIcons-Regular.ijmap'));
app.use('/MaterialIcons-Regular.svg', express.static('./node_modules/material-design-icons/iconfont/MaterialIcons-Regular.svg'));
app.use('/MaterialIcons-Regular.ttf', express.static('./node_modules/material-design-icons/iconfont/MaterialIcons-Regular.ttf'));
app.use('/MaterialIcons-Regular.woff', express.static('./node_modules/material-design-icons/iconfont/MaterialIcons-Regular.woff'));
app.use('/MaterialIcons-Regular.woff2', express.static('./node_modules/material-design-icons/iconfont/MaterialIcons-Regular.woff2'));
app.use('/files', express.static('./node_modules/typeface-hind-siliguri/files'));

const buildStyles = () => {
	return Bluebird
		.all([
			fs.readFileAsync(`${__dirname}/client/style.less`, 'utf8'),
			fs.readFileAsync(`${__dirname}/client/palette.json`, 'utf8')
		])
		.spread((style, palette) => {
			palette = JSON.parse(palette);
			palette = Object.entries(palette).map(([key, value]) => `@${key}: ${value};`).join('\n');
			return less.render(style.replace(/.*palette.json.*/, palette));
		})
		.then(output => output.css);
};

app.get('/style.css', (req, res, next) => {
	buildStyles()
		.then(css => res.set('Content-Type', 'text/css').send(css))
		.catch(next);
});

let rollupCache, jsMap;
const buildScripts = () => {
	console.time('Built script');
	return rollup
		.rollup({
			input: `${__dirname}/client/main.js`,
			cache: rollupCache,
			treeshake: false,
			plugins: [
				json(),
				resolve({ browser: true, jsnext: true }),
				commonjs()
			],
			onwarn: warning => {
				if (warning.code === 'CIRCULAR_DEPENDENCY') { return; }
				console.log(warning.message);
			}
		})
		.then(bundle => {
			rollupCache = bundle;
			return bundle.generate({
				name: 'tmp',
				sourcemap: true,
				format: 'iife',
				indent: false
			});
		}).then(result => {
			console.timeEnd('Built script');
			let js = result.code;
			if (result.map) {
				js += '\n//# sourceMappingURL=bundle.js.map';
				jsMap = result.map.toString();
			}
			return js;
		});
};

app.get('/bundle.js', (req, res, next) => {
	buildScripts()
		.then(js => res.set('Content-Type', 'text/js').send(js))
		.catch(next);
});

app.get('/bundle.js.map', (req, res) => res.set('Content-Type', 'text/js').send(jsMap));

const listPeople = () => {
	let people = [];
	return fs.readdirAsync('people')
		.map(file => {
			return fs.readFileAsync(`people/${file}`, 'utf8')
				.then(JSON.parse)
				.then(({ id, firstName, lastName }) => {
					if (!people.find(p => p.id === id)) {
						people.push({ id, firstName, lastName });
					}
				});
		})
		.then(() => people);
};

const getPersonFilename = id => {
	return fs.readdirAsync('people')
		.then(files => {
			return files.reverse().find(file => file.endsWith(`${id}.json`)); // find latest version
		});
};

app.get('/api/person', (req, res, next) => {
	listPeople()
		.then(people => res.json(people))
		.catch(next);
});

app.post('/api/person', (req, res, next) => {
	let person = mhealthgen.generate({ days: 400 });
	let date = (new Date()).toISOString().slice(0, 19);
	fs.writeFileAsync(`${__dirname}/people/${date}-${person.id}.json`, JSON.stringify(person, null, 2), 'utf8')
		.then(() => res.json({}))
		.catch(next);
});

app.get('/api/person/:id', (req, res, next) => {
	getPersonFilename(req.params.id)
		.then(filename => {
			res.sendFile(`${__dirname}/people/${filename}`,  err => {
				if (err) { next(err); }
			});
		})
		.catch(next);
});

app.put('/api/person/:id', (req, res, next) => {
	getPersonFilename(req.params.id)
		.then(filename => {
			return fs.readFileAsync(`${__dirname}/people/${filename}`, 'utf8');
		})
		.then(file => {
			let person = JSON.parse(file);
			person = mhealthgen.generate({ days: 400, person });
			let date = (new Date()).toISOString().slice(0, 19);
			return fs.writeFileAsync(`${__dirname}/people/${date}-${person.id}.json`, JSON.stringify(person, null, 2), 'utf8');
		})
		.then(() => res.json({}))
		.catch(next);
});

const pubmed = q => {
	let url = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=10&sort=relevance&term=' + q;
	return request({ url })
		.then(body1 => {
			let url = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&rettype=abstract&id=' + body1.esearchresult.idlist.join(',');
			return request({ url })
				.then(body2 =>  ({
					count: body1.esearchresult.count,
					query: body1.esearchresult.querytranslation,
					results: Object.values(body2.result).filter(r => r.authors).map(r => {
						let doi = (r.elocationid || '').slice(4).trim();
						return {
							title: r.title,
							published: moment(r.pubdate, 'YYYY MMM DD').toISOString(),
							authors: r.authors.map(a => a.name),
							journal: r.fulljournalname,
							doi,
							url: doi ? 'http://dx.doi.org/' + doi : null
						};
					})
				}));
		});
};

app.get('/api/pubmed/:query', (req, res, next) => {
	pubmed(req.params.query)
		.then(response => res.json(response))
		.catch(next);
});

const image = q => {
	let url = 'https://api.qwant.com/api/search/images?count=1&q=' + q,
		headers = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3202.62 Safari/537.36' };
	return request({ url, headers })
		.then(body => request({ url: body.data.result.items[0].media, json: false }));
};

app.get('/api/image/:query', (req, res, next) => {
	image(req.params.query.replace(/.\w+$/, '')) // remove extension
		.then(image => {
			res.set('content-type', 'image/jpeg');
			res.send(image);
		})
		.catch(next);
});

app.use('*', (req, res) => res.sendFile(`${__dirname}/client/index.html`));

app.use((err, req, res, next) => {
	console.error('error', err);
	res.status(500).json({ error: err.type, message: err.message });
	next();
});

if (require.main === module) {
	app.listen(2040);
	console.log('Listening on http://localhost:2040');
}

module.exports = { buildStyles, buildScripts, listPeople, getPersonFilename, pubmed, image };

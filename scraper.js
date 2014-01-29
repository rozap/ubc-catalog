#!/usr/bin/env node

"use strict";
var wubwub = require('wubwub')


var rcourseNum = /course=(\d{2,3}[A-Z]?)/;
var rdept = /dept=([A-Z]{2,4})/i;

var courses = [];



var Course = function() {
	this.fields = ['title', 'description', 'units', 'prerequisites', 'courseNumber', 'department', 'corequisites', 'crnc'];
};


Course.prototype.print = function() {
	console.log("COURSE =======");
	for (var i in this.fields) {
		console.log(this.fields[i] + ':', this[this.fields[i]]);
	}
	console.log("\n");
}

Course.prototype.toJSON = function() {
	var o = {};
	for (var i in this.fields) {
		o[this.fields[i]] = this[this.fields[i]] || false;
	}
	return o;
}

Course.prototype.add = function() {
	for (var i in this.fields) {
		if (!this.hasOwnProperty(this.fields[i])) return;
	}
	this.print();
	courses.push(this);

}

Course.prototype.set = function(name, value) {
	this[name] = value;
	return this;
}



wubwub.crawl({
	'routes': {
		//Routes that get called and crawling does not progress beyond
		'leaf': {
			'https://courses.students.ubc.ca.*req=\\d&dept=[A-Z]{2,4}&course=\\d{2,3}[A-Z]?$': function(tr, link) {
				var course = new Course();
				course.set('courseNumber', rcourseNum.exec(link)[1]);
				course.set('department', rdept.exec(link)[1])

				//lil helper to get the text from a stream, removing html tag stuff
				var getText = function(el, cb) {
					var st = el.createReadStream(),
						data = '';
					st.on('data', function(chunk) {
						data += chunk;
					})
					st.on('end', function() {
						data = data.replace(/<.*?>/g, '');
						cb(data);
					});
				}

				tr.on('end', function() {
					var fs = require('fs');
					fs.writeFile("courses/" + course.department + '-' +
						course.courseNumber + '.json', JSON.stringify(course), function(err) {
							if (err) {
								console.log(err);
							} else {
								course.print();
							}
						});
				});


				var p = tr.select('.content.expand p');
				getText(p, function(description) {
					course.set('description', description);
				});


				tr.selectAll('.content.expand p', function(p) {
					getText(p, function(info) {
						//So this can be one of three things..
						//credits, pre-reqs, or other crap
						//
						var credits = function(text) {
							var result = /credits: (\d+)/i.exec(text);
							return result && course.set('units', parseInt(result[1]));
						}

						var prereqs = function(text) {
							var result = /Pre-reqs:\s+(.*)/i.exec(text);
							return result && course.set('prerequisites', result[1]);
						}
						if (credits(info)) return;
						if (prereqs(info)) return;
						return;
					});
				});
				tr.selectAll('h4', function(h) {
					getText(h, function(title) {
						course.set('title', title);
					});
				});

			},
		},
		//Routes that get called and all links are enqueued
		'tree': {
			'https://courses.students.ubc.ca.*req=\\d&dept=[A-Z]{2,4}$': function(tr, link) {
				// console.log("TREE", link);
			},
		},
		//Routes not to follow
		'ignore': ['cs_quick_help'],



	},
	'seed': ['https://courses.students.ubc.ca/cs/main?pname=subjarea&tname=subjareas&req=0'],
	'concurrency': 30,
	'backend': new wubwub.Backends.Simple()
});
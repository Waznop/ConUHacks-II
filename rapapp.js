// constants
var frequencyThreshhold = 10;
var frequencyMultiplier = 1.5;
var relevance100k = 10;
var relevance150k = 20;
var relevanceMax = 30;
var flowScoreMax = 30;
var endRhymeScoreMax = 40;

// global stats
var totalRhyme = 0;
var topic = "";
var endWordCount = {}; // word : count
var endPronsDict = {}; // word : count
var status = "Freestyle";
var lineNumber = 0;
var strictNumSyllables = 0;

// line stats
var prevProns = []; // word[][]
var totalSyllables = 0;
var bestRhyme = 0;
var bestAlliteration = 0;
var curLine = []; // word[]
var curLineIdx = 0;
var lineWordCount = {}; // word : count
var curRelevance = 0;
var flowScore = 0;

function resetLineStats() {
	prevProns = [];
	totalSyllables = 0;
	bestRhyme = 0;
	bestAlliteration = 0;
	curLine = [];
	curLineIdx = 0;
	lineWordCount = {};
	curRelevance = 0;
	flowScore = 0;
}

function resetGlobalStats() {
	totalRhyme = 0;
	endWordCount = {};
	endPronsDict = {};
	strictNumSyllables = 0;
}

// mutates flowScore
function updateFlowScore() {
	if (bestRhyme > 1) {
		flowScore += 20;
	}
	if (bestAlliteration > 1) {
		flowScore += 10;
	}
	for (int i = 0; i < bestRhyme - 1; ++i) {
		flowScore += 5;
	}
	for (int i = 0; i < bestAlliteration - 1; ++i) {
		flowScore += 5;
	}
	if (flowScore > flowScoreMax) {
		flowScore = flowScoreMax;
	}
}

// mutates lineWordCount and prevProns
function calculateWordScore(res) {
	if (lineWordCount[res.word]) {
		++lineWordCount[res.word];
		return;
	}
	lineWordCount[res.word] = 1;
	lineRhyme(res.pron);
	alliteration(res.pron);
	updateFlowScore();
	calculateRelevance(res.relevance, res.freq);
	prevProns.push(res.pron);
}

// mutates endWordCount
function calculateLineScore(res) {
	if (endWordCount[res.word]) {
		++endWordCount[res.word];
		return;
	}
	endWordCount[res.word] = 1;
	endRhyme(res.pron);
	checkStructure(totalSyllables);
}

// mutates totalRhyme
function checkStructure() {
	switch(status) {
		case "haiku":
			if (lineNumber == 1 || lineNumber == 3) {
				if (totalSyllables != 5) {
					totalRhyme = 0;
				}
			} else if (lineNumber == 2) {
				if (totalSyllables != 7) {
					totalRhyme = 0;
				}
			} else {
				totalRhyme = 0;
			}
			break;
		case "strict":
			if (strictNumSyllables == 0) {
				strictNumSyllables = totalSyllables;
			} else if (strictNumSyllables != totalSyllables) {
				totalRhyme = 0;
			}
	}
}

// mutates endPronsDict and curTotalRhyme
function endRhyme(pron) {
	var endRhyme = pron[pron.length-1];
	if (endPronsDict[endRhyme]) {
		++endPronsDict[endRhyme];
	} else {
		endPronsDict[endRhyme] = 1; 
	}
	var curTotalRhyme = 0;
	Object.keys(endPronsDict).forEach(key => {
		var occurrences = endPronsDict[key];
		if (occurrences > 1) {
			curTotalRhyme += occurrences;
		}
	})
	curTotalRhyme = curTotalRhyme * endRhymeScoreMax / lineNumber;
	if (curTotalRhyme > totalRhyme) {
		totalRhyme = curTotalRhyme;
	}
}

// mutates curRelevance
function calculateRelevance(relevance, freq) {
	var multiplier = freq < frequencyThreshhold ? frequencyMultiplier : 1;
	if (relevance > 150000 && curRelevance < relevanceMax) {
		curRelevance += relevance150k * multiplier;
	} else if (relevance > 100000 && curRelevance < relevanceMax) {
		curRelevance += relevance100k * multiplier;
	}
	if (curRelevance > relevanceMax) {
		curRelevance = relevanceMax;
	}
}

// mutates bestRhyme
function lineRhyme(pron) {
	var curRhyme = 0;
	for (var i = 0; i < prevProns.length; ++i) {
		var prevPron = prevProns[i];
		var prevPronIdx = prevPron.length-1;
		var curPronIdx = pron.length-1;
		while (prevPronIdx >= 0 && curPronIdx >= 0) {
			if (prevPron[prevPronIdx] == pron[curPronIdx]) {
				++curRhyme;
			} else {
				break;
			}
			--prevPronIdx;
			--curPronIdx;
		}
	}
	if (curRhyme > bestRhyme) {
		bestRhyme = curRhyme;
	}
}

// mutates bestAlliteration
function alliteration(pron) {
	var curAlliteration = 0;
	for (var i = 0; i < prevProns.length; ++i) {
		var prevPron = prevProns[i];
		for (var i = 0; i < prevPron.length && i < pron.length; ++i) {
			if (prevPron[i] == pron[i]) {
				++curAlliteration;
			} else {
				break;
			}
		}
	}
	if (curAlliteration > bestAlliteration) {
		bestAlliteration = curAlliteration;
	}
}

// sends the actual request
function analyze(word, topic) {
	var link = "//api.datamuse.com/words?md=rfs&sp=" + word + "&topics=" + topic;
	var xhr = new XMLHttpRequest();
	xhr.open('GET', link, true);
	xhr.send();
	xhr.addEventListener("readystatechange", processRequest, false);

	function processRequest(e) {
		var res = {};
		res.word = word;
	    if (xhr.readyState == 4 && xhr.status == 200) {
	        var response = JSON.parse(xhr.responseText);
	        for (var i = 0; i < response.length; ++i) {
	        	var curWord = response[i];
	        	if (curWord.word == word) {
	        		res.pron = curWord.tags[0].slice(5, -1).split(' ');
	        		res.freq = Number(curWord.tags[1].slice(2));
	        		res.relevance = curWord.score ? (curWord.score > 0 ? curWord.score : -curWord.score) : 0;
	        		totalSyllables += curWord.numSyllables;
	        		break;
	        	}
	        }
	    }
	    if (!res.freq) {
	    	res.pron = [];
	    	res.freq = 0;
	    	res.relevance = 0;
	    	totalSyllables += numSyllables(word);
	    }
	    calculateWordScore(res);
	    ++curLineIdx;
	    if (curLineIdx == curLine.length) {
	    	calculateLineScore(res);
	    } else if (curLineIdx < curLine.length) {
	    	resetLineStats();
	    	analyze(curLine[curLineIdx], topic);
	    }
	}
}

// string -> word[]
function parseString(str) {
	var arr = str.match(/[a-z]+|[0-9]+/gi);
	if (!arr) return;
	for (var i = 0; i < arr.length; ++i) {
		var word = arr[i];
		if (!isNaN(parseInt(word))) { // if it's a number
			numWord = numToWord(word);
			numWordArr = numWord.match(/[a-z]+/gi);
			for (var j = 0; j < numWordArr.length; ++j) {
				curLine.push(numWordArr[j]);
			}
		} else {
			curLine.push(word);
		}
	}
	resetGlobalStats();
	resetLineStats();
	analyze(curLine[curLineIdx], topic);
}

// word -> int
function numSyllables(word) {
  word = word.replace(/(?:[^laeiouy]es?|ed)$/i, '');
  word = word.replace(/^y/, '');
  arr = word.match(/[aeiouy]{1,2}/g);
  return arr ? arr.length : 0;
}

// int -> string
function numToWord(num) {
	var a = ['','one ','two ','three ','four ', 'five ','six ','seven ','eight ','nine ','ten ',
	'eleven ','twelve ','thirteen ','fourteen ','fifteen ','sixteen ','seventeen ','eighteen ','nineteen '];
	var b = ['', '', 'twenty','thirty','forty','fifty', 'sixty','seventy','eighty','ninety'];

	function inWords(num) {
	    if ((num = num.toString()).length > 9) return ''; // overflow
	    n = ('000000000' + num).substr(-9).match(/^(\d{1})(\d{2})(\d{1})(\d{2})(\d{1})(\d{2})$/);
	    if (!n) return;
    	var str = '';
    	str += (n[1] != 0) ? (a[Number(n[1])]) + 'hundred ' : '';
	    str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'million ' : '';
    	str += (n[3] != 0) ? (a[Number(n[3])]) + 'hundred ' : '';
	    str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'thousand ' : '';
	    str += (n[5] != 0) ? (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) + 'hundred ' : '';
	    str += (n[6] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[6])] || b[n[6][0]] + ' ' + a[n[6][1]]) : '';
	    return str;
	}
	return num == 0 ? "zero" : inWords(num);
}


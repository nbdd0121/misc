'use strict';

var episilon = 1e-8;

function Constant(value) {
	var ret = Object(value);
	ret.type = 'Constant';
	ret.value = value;
	ret.cachedNormalization = ret;
	ret.cachedResult = String(value);
	return ret;
}

function Node(value, op, arr) {
	arr.type = op;
	arr.value = value;
	arr.cachedNormalization = null;
	arr.cachedResult = null;
	return arr;
}

/* Flatten a + node or * node */
function flatten(node) {
	var arr = normalize(node[0]);
	if (arr.type === node.type) {
		arr = arr.slice();
	} else {
		arr = [arr];
	}
	var operand = normalize(node[1]);
	if (operand.type !== node.type) {
		arr.push(operand);
	} else {
		Array.prototype.push.apply(arr, operand);
	}
	return Node(node.value, node.type, arr);
}

function extractNeg(node) {
	var arr = normalize(node[0]);
	if (arr.type === '+') {
		arr = arr.slice();
	} else {
		arr = [arr];
	}
	var operand = normalize(node[1]);
	if (operand.type !== '+') {
		if (operand.value === 0) {
			arr.push(operand);
		} else {
			arr.push(Node(-operand.value, 'neg', [operand]));
		}
	} else {
		for (var i = 0; i < operand.length; i++) {
			if (operand[i].type === 'neg') {
				arr.push(operand[i][0]);
			} else {
				if (operand[i].value === 0) {
					arr.push(operand[i]);
				} else {
					arr.push(Node(-operand[i].value, 'neg', [operand[i]]));
				}
			}
		}
	}
	return Node(node.value, '+', arr);
}

function extractRec(node) {
	var arr = normalize(node[0]);
	if (arr.type === '*') {
		arr = arr.slice();
	} else {
		arr = [arr];
	}
	var operand = normalize(node[1]);
	if (operand.type !== '*') {
		if (operand.value === 1 || operand.value === -1) {
			arr.push(operand);
		} else {
			arr.push(Node(1 / operand.value, 'rec', [operand]));
		}
	} else {
		for (var i = 0; i < operand.length; i++) {
			if (operand[i].type === 'rec') {
				arr.push(operand[i][0]);
			} else {
				if (operand[i].value === 1 || operand[i].value === -1) {
					arr.push(operand[i]);
				} else {
					arr.push(Node(1 / operand[i].value, 'rec', [operand[i]]));
				}
			}
		}
	}
	return Node(node.value, '*', arr);
}

function reorder(node) {
	node.sort(function(a, b) {
		var aNeg = a.type === 'neg' || a.type === 'rec';
		var bNeg = b.type === 'neg' || b.type === 'rec';
		if (aNeg && !bNeg) return 1;
		if (bNeg && !aNeg) return -1;
		var as = codegen(a),
			bs = codegen(b);
		if (as.length !== bs.length)
			return as.length - bs.length;
		return as < bs ? -1 : 1;
	});
	return node;
}

function normalize(node) {
	if (node.cachedNormalization) {
		return node.cachedNormalization;
	}
	var result;
	switch (node.type) {
		case '-':
			result = reorder(extractNeg(node));
			break;
		case '/':
			result = reorder(extractRec(node));
			break;
		case '+':
		case '*':
			result = reorder(flatten(node));
			break;
		default:
			throw 'Assertion Failure';
	}
	node.cachedNormalization = result;
	return result;
}

function reduction(result, arr, target, index, a, b) {
	arr[index] = Node(a.value + b.value, '+', [a, b]), enumeration(result, arr, target);
	arr[index] = Node(a.value - b.value, '-', [a, b]), enumeration(result, arr, target);
	arr[index] = Node(b.value - a.value, '-', [b, a]), enumeration(result, arr, target);
	arr[index] = Node(a.value * b.value, '*', [a, b]), enumeration(result, arr, target);
	arr[index] = Node(a.value / b.value, '/', [a, b]), enumeration(result, arr, target);
	arr[index] = Node(b.value / a.value, '/', [b, a]), enumeration(result, arr, target);
}

function enumeration(result, arr, target) {
	if (arr.length == 1) {
		if (Math.abs(arr[0].value - target) < episilon) {
			result.push(arr[0]);
		}
		return;
	}
	var clone = arr.slice(1);
	var length = arr.length;
	for (var i = 0; i < length; i++) {
		var a = arr[i];
		for (var j = i; j < length - 1; j++) {
			var b = arr[j + 1];
			reduction(result, clone, target, j, a, b);
			clone[j] = b;
		}
		clone[i] = a;
	}
}

function codegen(node) {
	if (node.cachedResult) {
		return node.cachedResult;
	}
	var result;
	switch (node.type) {
		case 'neg':
			result = '-' +
				(node[0].type === '+' ? '(' + codegen(node[0]) + ')' : codegen(node[0]));
			break;
		case 'rec':
			result = '/' +
				(node[0].type === 'Constant' ? codegen(node[0]) : '(' + codegen(node[0]) + ')');
			break;
		case '+':
			if (node[0].type === 'neg') throw 'Assertion Failure';
			result = codegen(node[0]);
			for (var i = 1; i < node.length; i++) {
				if (node[i].type === 'neg') {
					result += codegen(node[i]);
				} else {
					result += '+' + codegen(node[i]);
				}
			}
			break;
		case '*':
			if (node[0].type === 'rec') throw 'Assertion Failure';
			result = node[0].type === 'Constant' ? codegen(node[0]) : '(' + codegen(node[0]) + ')';
			for (var i = 1; i < node.length; i++) {
				if (node[i].type === 'rec') {
					result += codegen(node[i]);
				} else {
					result += '*' + (node[i].type === 'Constant' ? codegen(node[i]) : '(' + codegen(node[i]) + ')');
				}
			}
			break;
		default:
			throw 'Assertion Failure';
	}
	return node.cachedResult = result;
}

function unique(arr) {
	return arr.filter(function(val, id) {
		return arr.indexOf(val, id + 1) === -1;
	});
}

function calc(arr, target) {
	var result = [];
	arr = arr.map(Constant);
	enumeration(result, arr, target);
	return unique(result.map(normalize).map(codegen));
}

function test(length, maximum, target) {
	var array = new Array(length);
	var stats = {
		total: 0,
		success: 0,
		fail: 0,
		fails: []
	};

	function generateNumbers(index, start) {
		if (index === length) {
			stats.total++;
			if (calc(array, target).length === 0) {
				stats.fails.push(array.toString());
				stats.fail++;
			} else {
				stats.success++;
			}
			return;
		}
		for (var i = start; i <= maximum; i++) {
			array[index] = i;
			generateNumbers(index + 1, i);
		}
	}
	generateNumbers(0, 1);
	return stats;
}
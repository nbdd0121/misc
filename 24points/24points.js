var episilon = 1e-8;

function Constant(value) {
	var ret = Object(value);
	ret.type = 'Constant';
	ret.value = value;
	return ret;
}

function Node(value, op, l, r) {
	return MakeNode(value, op, [l, r]);
}

function UnaryNode(value, op, operand) {
	return MakeNode(value, op, [operand]);
}

function MakeNode(value, op, arr) {
	arr.type = op;
	arr.value = value;
	return arr;
}

/* Flatten a + node or * node */
function flatten(node) {
	var arr = [];
	for (var i = 0; i < node.length; i++) {
		var n = normalize(node[i]);
		if (n.type !== node.type) {
			arr.push(n);
		} else {
			Array.prototype.push.apply(arr, n);
		}
	}
	return MakeNode(node.value, node.type, arr);
}

function extractNeg(node) {
	var operand = node[0];
	if (operand.type !== '+') {
		if (operand.value === 0) return operand;
		return node;
	}
	var arr = [];
	for (var i = 0; i < operand.length; i++) {
		if (operand[i].type === 'neg') {
			arr.push(operand[i][0]);
		} else {
			if (operand[i].value === 0) {
				arr.push(operand[i]);
			} else {
				arr.push(UnaryNode(-operand[i].value, 'neg', operand[i]));
			}
		}
	}
	return MakeNode(node.value, '+', arr);
}

function extractRec(node) {
	var operand = node[0];
	if (operand.type !== '*') {
		if (operand.value === 1 || operand.value === -1) return operand;
		return node;
	}
	var arr = [];
	for (var i = 0; i < operand.length; i++) {
		if (operand[i].type === 'rec') {
			arr.push(operand[i][0]);
		} else {
			if (operand[i].value === 1 || operand[i].value === -1) {
				arr.push(operand[i]);
			} else {
				arr.push(UnaryNode(1 / operand[i].value, 'rec', operand[i]));
			}
		}
	}
	return MakeNode(node.value, '*', arr);
}

function reorder(node) {
	node.sort(function(a, b) {
		var as = codegen(a),
			bs = codegen(b);
		var aNeg = as[0] === '/' || as[0] === '-';
		var bNeg = bs[0] === '/' || bs[0] === '-';
		if (aNeg && !bNeg) return 1;
		if (bNeg && !aNeg) return -1;
		if (as.length !== bs.length)
			return as.length - bs.length;
		return as < bs ? -1 : 1;
	});
	return node;
}

function normalize(node) {
	switch (node.type) {
		case 'Constant':
			return node;
		case '-':
			return normalize(Node(node.value, '+', node[0], UnaryNode(-node[1].value, 'neg', normalize(node[1]))));
		case '/':
			return normalize(Node(node.value, '*', node[0], UnaryNode(1 / node[1].value, 'rec', normalize(node[1]))));
		case '+':
		case '*':
			return reorder(flatten(node));
		case 'neg':
			return extractNeg(node);
		case 'rec':
			return extractRec(node);
		default:
			throw 'Assertion Failure';
	}
}

function reduction(result, a, b, arr, i, target) {
	arr[i] = Node(a.value + b.value, '+', a, b), enumeration(result, arr, target);
	arr[i] = Node(a.value - b.value, '-', a, b), enumeration(result, arr, target);
	arr[i] = Node(b.value - a.value, '-', b, a), enumeration(result, arr, target);
	arr[i] = Node(a.value * b.value, '*', a, b), enumeration(result, arr, target);
	arr[i] = Node(a.value / b.value, '/', a, b), enumeration(result, arr, target);
	arr[i] = Node(b.value / a.value, '/', b, a), enumeration(result, arr, target);
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
			reduction(result, a, b, clone, j, target);
			clone[j] = b;
		}
		clone[i] = a;
	}
}

function codegen(node) {
	if (node.cachedResult)
		return node.cachedResult;
	var result;
	switch (node.type) {
		case 'Constant':
			return String(node.value);
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
function Constant(value) {
	var ret = Object(value);
	ret.type = 'Constant';
	ret.value = value;
	return ret;
}

function Node(value, l, r, op) {
	var ret = [];
	ret.type = op;
	ret[0] = l;
	ret[1] = r;
	ret.value = value;
	return ret;
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
	arr.type = node.type;
	return arr;
}

function reorder(node) {
	node.sort(function(a, b) {
		var as = codegen(a),
			bs = codegen(b);
		if (as[0] === '/' || as[0] === '-') return 1;
		if (bs[0] === '/' || bs[0] === '-') return -1;
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
			return normalize(Node(node.value, node[0], {
				type: 'neg',
				0: normalize(node[1]),
				length: 1
			}, '+'));
		case '/':
			return normalize(Node(node.value, node[0], {
				type: 'rec',
				0: normalize(node[1]),
				length: 1
			}, '*'));
		case '+':
		case '*':
			return reorder(flatten(node));
		case 'neg':
		case 'rec':
			return node;
		default:
			throw 'Assertion Failure';
	}
}

function reduction(result, a, b, arr, i, target) {
	arr[i] = Node(a.value + b.value, a, b, '+'), enumeration(result, arr, target);
	arr[i] = Node(a.value - b.value, a, b, '-'), enumeration(result, arr, target);
	arr[i] = Node(b.value - a.value, b, a, '-'), enumeration(result, arr, target);
	arr[i] = Node(a.value * b.value, a, b, '*'), enumeration(result, arr, target);
	arr[i] = Node(a.value / b.value, a, b, '/'), enumeration(result, arr, target);
	arr[i] = Node(b.value / a.value, b, a, '/'), enumeration(result, arr, target);
}

function enumeration(result, arr, target) {
	if (arr.length == 1) {
		if (arr[0].value == target) {
			result.push(arr[0]);
		}
		return;
	}
	for (var i = 0; i < arr.length - 1; i++) {
		var clone = arr.slice();
		clone.splice(i, 1);
		for (var j = i; j < clone.length; j++) {
			reduction(result, arr[i], arr[j + 1], clone, j, target);
			clone[j] = arr[j + 1];
		}
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
	for (var i = 0; i < arr.length; i++) {
		arr[i] = Constant(arr[i]);
	}
	enumeration(result, arr, target);

	return unique(result.map(normalize).map(codegen));
}
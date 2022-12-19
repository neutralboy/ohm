import * as ohm from 'ohm-js';
import * as extras from 'ohm-js/extras';
import {test} from 'uvu';
import * as assert from 'uvu/assert';

import greeting, {GreetingActionDict} from '../src/greeting.ohm-bundle';

const g: ohm.Grammar = ohm.grammar(`
  G {
    Greeting = interjection "," name "!"
    interjection = "Hello" | "Hi" | "Ahoy-hoy"
    name = upper letter+
  }
`);
const s: ohm.Semantics = g.createSemantics().addOperation('getName', {
  Greeting(interj, comma, name, punc) {
    return name.sourceString;
  }
});

test('basic matching', () => {
  const matchResult = g.match('Ahoy-hoy, Alexander!');
  assert.is(s(matchResult)['getName'](), 'Alexander');
});

test('incremental matching', () => {
  const matcher = g.matcher();
  matcher.setInput('foo');
  matcher.replaceInputRange(0, 1, 'g').replaceInputRange(1, 3, 'ah');
  assert.is(matcher.getInput(), 'gah');
  assert.is(matcher.match('Greeting').succeeded(), false);
});

test('pexprs - #390', () => {
  const {interjection, name, any, end} = g.rules;

  if (interjection.body instanceof ohm.pexprs.Alt) {
    assert.instance(interjection.body.terms[0], ohm.pexprs.Terminal);
  } else {
    assert.unreachable('expected an Alt');
  }

  if (name.body instanceof ohm.pexprs.Seq) {
    const plus = name.body.factors[1];
    assert.instance(plus, ohm.pexprs.Iter);
    assert.instance(plus, ohm.pexprs.Plus);
  } else {
    assert.unreachable('expected a Seq');
  }

  assert.is(any.body, ohm.pexprs.any, 'any should be a singleton');
  assert.is(end.body, ohm.pexprs.end, 'end should be a singleton');
});

test('ActionDict keys - #395', () => {
  type MapKey = Exclude<keyof GreetingActionDict<any>, keyof ohm.BaseActionDict<any>>;
  const x: MapKey = 'hello';
});

test('extras - getLineAndColumn & getLineAndColumnMessage', () => {
  const str = 'one\ntwo';
  const offset = 4;
  const ranges = [
    [0, 2],
    [3, 6]
  ];
  assert.is(
    extras.getLineAndColumn(str, offset).toString(...ranges),
    extras.getLineAndColumnMessage(str, offset, ...ranges)
  );
});

test('getLineAndColumn - #410', t => {
  const matchResult = g.match('Sup friend!');
  t.true(matchResult.failed());
  const lineAndCol = matchResult.getInterval().getLineAndColumn();
  t.is(lineAndCol.offset, 0);
  t.is(lineAndCol.lineNum, 1);
  t.is(lineAndCol.colNum, 1);
  t.is(lineAndCol.line, 'Sup friend!');
  t.is(lineAndCol.prevLine, null);
  t.is(lineAndCol.nextLine, null);
});

test('asIteration - #407', t => {
  const g = ohm.grammar(`
    G {
      start = letters
      letters = listOf<letter>
  `);
  const s = g.createSemantics().addOperation('x', {
    start(letters) {
      return letters.asIteration().isIteration()
    }
  });
  t.is(s(g.match('abc')).x(), true);
});


test('Interval typings', t => {
  const inputStr = ' Sup friend!   ';
  const matchFailure = g.match(inputStr);
  t.true(matchFailure.failed());

  const interval = matchFailure.getInterval();
  interval.startIdx = 1;
  interval.endIdx = inputStr.length;
  t.is(interval.sourceString, ' Sup friend!   ');
  t.is(interval.contents, 'Sup friend!   ');
  t.is(interval.trimmed().contents, 'Sup friend!');

  const left = interval.collapsedLeft();
  const right = interval.collapsedRight();
  t.is(left.startIdx, interval.startIdx);
  t.is(right.startIdx, interval.endIdx);

  const fat = interval.minus(interval.trimmed());
  t.is(fat.length, 1);
  t.is(fat[0].contents, '   ');
  t.is(fat[0].relativeTo(interval).startIdx, 11);
});

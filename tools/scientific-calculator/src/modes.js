/* LCD workflows for fx-991ES PLUS (2nd edition) functions.
 * Independent calculator implementation; no Casio firmware or external requests.
 * Reference: https://support.casio.com/global/en/calc/manual/fx-570ESPLUS_991ESPLUS_en/
 * The device controller owns drawing, editable fields and numbered menu keys.
 */
(function (root) {
  'use strict';
  function createDeviceModes(api) {
    const alg = api.alg, math = api.math;
    const state = () => api.getState();
    const scope = () => state().scope || (state().scope = {});
    const fmt = value => api.format ? api.format(value) : String(value);
    const menu = (title, entries, options) => api.showMenu(title, entries.map(([label, action]) => ({ label, action })), options);
    const insert = text => { api.closeMenu(); api.insert(text); };
    const error = (message, code = 'Math ERROR') => { const e = new Error(message); e.code = code; throw e; };
    const real = (value, label = 'Value') => {
      if (typeof value !== 'number' || !Number.isFinite(value)) error(label + ': real finite value required');
      return value;
    };
    const evaluate = (expression, values = scope()) => api.ev(expression, values);
    const number = text => real(evaluate(String(text), { ...scope() }));
    const input = (label, initial, done) => api.showInput(label, String(initial), text => done(text));
    const numeric = (label, initial, done) => input(label, initial, text => done(number(text)));
    const value = (answer, label) => { api.showValue(answer, label); if (typeof answer === 'number' || answer?.isComplex) scope().Ans = answer; };
    let activeMode = state().mode || 'COMP', answers = null, answerIndex = 0, answersKind = '';
    let equation = null, tableSpec = { expression: 'X^2', start: 1, end: 5, step: 1 }, tableRows = [];
    let lastCalc = '', lastSolve = '', statCursor = 0, previousFreq = state().freq === true || state().freq === 'on';

    function sequence(fields, done, index = 0, values = []) {
      if (index === fields.length) { done(values); return; }
      const field = fields[index];
      const submit = next => {
        const copy = values.slice(); copy[index] = next;
        sequence(fields, done, index + 1, copy);
      };
      if (field.complex) input(field.label, field.initial ?? 0, text => {
        const next = evaluate(text, { ...scope() });
        if (next?.isComplex && Number.isFinite(next.re) && Number.isFinite(next.im)) submit(next);
        else submit(real(next));
      });
      else numeric(field.label, field.initial ?? 0, submit);
    }

    // STAT: CASIO limits are 80 X rows, 40 X/FREQ or X/Y, 26 X/Y/FREQ.
    const types = [['1-VAR','one'],['A+BX','linear'],['_+CX²','quadratic'],['ln X','log'],['e^X','exp'],['A·B^X','ab'],['A·X^B','power'],['1/X','inverse']];
    const stats = () => {
      const s = state();
      if (!s.stats || !Array.isArray(s.stats.rows)) s.stats = { type: 'one', rows: [] };
      if (!types.some(t => t[1] === s.stats.type)) s.stats.type = 'one';
      const freq = s.freq === true || s.freq === 'on';
      if (freq !== previousFreq) { s.stats.rows = []; previousFreq = freq; }
      return s.stats;
    };
    const freqOn = () => state().freq === true || state().freq === 'on';
    const statLimit = () => stats().type === 'one' ? (freqOn() ? 40 : 80) : (freqOn() ? 26 : 40);
    function statType() {
      menu('STAT Type', types.map(([label, type]) => [label, () => {
        const data = stats();
        if ((data.type === 'one') !== (type === 'one')) data.rows = [];
        data.type = type;
        statRow(data.rows.length);
      }]));
    }
    function statRow(index, after) {
      const data = stats();
      if (index < 0 || index > data.rows.length) error('Row not found', 'Argument ERROR');
      if (index === data.rows.length && data.rows.length >= statLimit()) error('STAT maximum ' + statLimit() + ' rows', 'Insufficient MEM');
      statCursor = index;
      const old = data.rows[index] || { x: 0, y: 0, freq: 1 };
      const fields = [{ label: 'X[' + (index + 1) + '] =', initial: old.x }];
      if (data.type !== 'one') fields.push({ label: 'Y[' + (index + 1) + '] =', initial: old.y });
      if (freqOn()) fields.push({ label: 'FREQ[' + (index + 1) + '] =', initial: old.freq ?? 1 });
      sequence(fields, values => {
        const row = { x: values[0], freq: freqOn() ? values[values.length - 1] : 1 };
        if (!Number.isSafeInteger(row.freq) || row.freq < 0 || row.freq > 1e9) error('FREQ must be an integer from 0 to 1e9');
        if (data.type !== 'one') row.y = values[1];
        data.rows[index] = row;
        if (after) after(); else if (index + 1 < statLimit()) statRow(index + 1); else statData();
      });
    }
    function statData() {
      const data = stats();
      menu('STAT Data (' + data.rows.length + ')', [
        ['Add row', () => statRow(data.rows.length)],
        ...data.rows.map((row, i) => [(i + 1) + ': ' + fmt(row.x) + (data.type === 'one' ? '' : ',' + fmt(row.y)) + (freqOn() ? ' f=' + row.freq : ''), () => { statCursor = i; menu('Row ' + (i + 1), [
          ['Edit', () => statRow(i, statData)],
          ['Insert before', () => statInsert(i)],
          ['Delete', () => { data.rows.splice(i, 1); statData(); }]
        ]); }])
      ]);
    }
    function statInsert(index) {
      const data = stats();
      if (data.rows.length >= statLimit()) error('STAT row limit', 'Insufficient MEM');
      index = Math.min(index,data.rows.length);
      data.rows.splice(index,0,{x:0,...(data.type !== 'one' ? {y:0} : {}),freq:1});
      statRow(index,statData);
    }
    function statEdit() { menu('STAT Edit',[['Ins',() => statInsert(statCursor)],['Del-A',() => { stats().rows = []; statCursor = 0; statData(); }]]); }
    function statEditorMenu() { menu('STAT Editor',[['Type',statType],['Data',statData],['Edit',statEdit]]); }
    function statResult() { const d = stats(); return alg.stats(d.rows, d.type); }
    function statBasic() {
      const d = stats(), result = alg.stats(d.rows, 'one');
      if (d.type !== 'one') {
        const y = alg.stats(d.rows.map(r => ({ x: r.y, freq: r.freq })), 'one');
        Object.assign(result, { meanY: y.meanX, popStdY: y.popStdX, sampleStdY: y.sampleStdX, minY: y.minX, maxY: y.maxX });
        Object.assign(result.sums, { y: y.sums.x, y2: y.sums.x2, xy: math.sum(d.rows.map(r => r.x * r.y * (r.freq ?? 1))), x3: math.sum(d.rows.map(r => r.x ** 3 * (r.freq ?? 1))), x2y: math.sum(d.rows.map(r => r.x ** 2 * r.y * (r.freq ?? 1))), x4: math.sum(d.rows.map(r => r.x ** 4 * (r.freq ?? 1))) });
      }
      return result;
    }
    function scalarEntries(title, list) {
      menu(title, list.map(([label, get]) => [label, () => { const v = get(); if (v === null || v === undefined || !Number.isFinite(v)) error(label + ' is undefined for these data'); value(v, label); }]));
    }
    function statSum() {
      const keys = stats().type === 'one' ? [['Σx²','x2'],['Σx','x']] : [['Σx²','x2'],['Σx','x'],['Σy²','y2'],['Σy','y'],['Σxy','xy'],['Σx³','x3'],['Σx²y','x2y'],['Σx⁴','x4']];
      scalarEntries('STAT Sum', keys.map(([label, key]) => [label, () => statBasic().sums[key]]));
    }
    function statVar() {
      const fields = [['n','n'],['x̄','meanX'],['σx','popStdX'],['sx','sampleStdX']];
      if (stats().type !== 'one') fields.push(['ȳ','meanY'],['σy','popStdY'],['sy','sampleStdY']);
      scalarEntries('STAT Var', fields.map(([label, key]) => [label, () => statBasic()[key]]));
    }
    function statRegression() {
      const quadratic = stats().type === 'quadratic';
      const prediction = (axis, root = 0) => numeric((axis === 'x' ? 'Y' : 'X') + ' =', 0, n => {
        const r = statResult(), prediction = axis === 'x' ? r.predictX(n) : r.predictY(n);
        value(Array.isArray(prediction) ? prediction[root] : prediction, axis + '̂' + (quadratic && axis === 'x' ? root + 1 : ''));
      });
      menu('STAT Reg', [
        ...['A','B',quadratic ? 'C' : 'r'].map(key => [key, () => { const v = statResult().coefficients[key]; if (v === null) error('Correlation is undefined'); value(v, key); }]),
        [quadratic ? 'x̂1' : 'x̂', () => prediction('x', 0)],
        ...(quadratic ? [['x̂2', () => prediction('x', 1)]] : []),
        ['ŷ', () => prediction('y')]
      ]);
    }
    function statNormal() {
      menu('STAT Distr', [
        ...['P','Q','R'].map(name => [name + '(', () => numeric(name + '(t), t =', 0, t => value(alg['normal' + name](t), name + '(' + fmt(t) + ')'))]),
        ['→t', () => numeric('Normalize X =', 0, x => value(statBasic().normalized(x), 't'))]
      ]);
    }
    function statMenu() {
      menu('STAT', [
        ['Type', statType], ['Data', statData], ['Sum', statSum], ['Var', statVar],
        [stats().type === 'one' ? 'Distr' : 'Reg', stats().type === 'one' ? statNormal : statRegression],
        ['MinMax', () => scalarEntries('STAT MinMax', [['minX','minX'],['maxX','maxX'],...(stats().type !== 'one' ? [['minY','minY'],['maxY','maxY']] : [])].map(([label,key]) => [label, () => statBasic()[key]]))]
      ]);
    }

    // EQN coefficient input and replayable solution screens.
    function showAnswer() { const item = answers[answerIndex]; value(item.value, item.label + '  ' + (answerIndex + 1) + '/' + answers.length); }
    function solveEquation() {
      const e = equation;
      if (e.kind === 'linear') {
        const A = [], b = [];
        for (let r = 0; r < e.n; r++) { A.push(e.values.slice(r * (e.n + 1), r * (e.n + 1) + e.n)); b.push(e.values[r * (e.n + 1) + e.n]); }
        answers = alg.linear(A, b).map((v, i) => ({ label: ['X','Y','Z'][i] + '=', value: v }));
      } else answers = alg.polynomial(e.values).map((v, i) => ({ label: 'X' + (i + 1) + '=', value: v }));
      answersKind = 'eqn'; answerIndex = 0; showAnswer();
    }
    function equationInput() {
      const e = equation;
      const count = e.kind === 'linear' ? e.n * (e.n + 1) : e.n + 1;
      const fields = Array.from({ length: count }, (_, i) => ({ label: e.kind === 'linear' ? 'EQN ' + (Math.floor(i / (e.n + 1)) + 1) + ': ' + 'abcd'[i % (e.n + 1)] + ' =' : 'EQN ' + 'abcd'[i] + ' =', initial: e.values[i] ?? 0 }));
      sequence(fields, values => { e.values = values; solveEquation(); });
    }
    function equationMenu() {
      const choose = (kind, n) => { answers = null; equation = { kind, n, values: [] }; equationInput(); };
      menu('EQN', [['aX+bY=c', () => choose('linear',2)],['aX+bY+cZ=d', () => choose('linear',3)],['aX²+bX+c=0', () => choose('poly',2)],['aX³+bX²+cX+d=0', () => choose('poly',3)]]);
    }

    // Matrix and vector entries are numeric arrays, shared with the core engine.
    function variableMenu(kind, action) { menu(kind === 'Mat' ? 'MATRIX' : 'VECTOR', ['A','B','C'].map(name => [kind + name, () => action(kind + name)])); }
    function dimension(kind, name) {
      if (kind === 'Vct') { menu(name + ' Dim', [['3 dimensions', () => editArray(name, 1, 3, true)],['2 dimensions', () => editArray(name, 1, 2, true)]]); return; }
      menu(name + ' Dim', [[3,3],[3,2],[3,1],[2,3],[2,2],[2,1],[1,3],[1,2],[1,1]].map(([r,c]) => [r + '×' + c, () => editArray(name,r,c,true)]),{pageSize:9});
    }
    function editArray(name, rows, cols, clear = false) {
      const vector = name.startsWith('Vct');
      const old = clear ? null : scope()[name];
      const fields = Array.from({ length: rows * cols }, (_, i) => {
        const r = Math.floor(i / cols), c = i % cols;
        return { label: name + '[' + (vector ? c + 1 : (r + 1) + ',' + (c + 1)) + '] =', initial: old ? (vector ? old[c] : old[r][c]) : 0 };
      });
      sequence(fields, values => {
        const result = vector ? values : Array.from({ length: rows }, (_, r) => values.slice(r * cols, (r + 1) * cols));
        scope()[name] = result;
        api.setExpression(name); api.showValue(result, name + ' stored');
      });
    }
    function arrayData(kind) {
      variableMenu(kind, name => {
        const current = scope()[name];
        if (!Array.isArray(current)) { dimension(kind,name); return; }
        editArray(name, kind === 'Vct' ? 1 : current.length, kind === 'Vct' ? current.length : current[0].length);
      });
    }
    function matrixMenu() {
      menu('MATRIX', [['Dim', () => variableMenu('Mat', name => dimension('Mat',name))],['Data', () => arrayData('Mat')],...['MatA','MatB','MatC','MatAns'].map(name => [name, () => insert(name)]),['det(', () => insert('det(')],['Trn(', () => insert('transpose(')],['inverse(', () => insert('inverse(')]]);
    }
    function vectorMenu() {
      menu('VECTOR', [['Dim', () => variableMenu('Vct', name => dimension('Vct',name))],['Data', () => arrayData('Vct')],...['VctA','VctB','VctC','VctAns'].map(name => [name, () => insert(name)]),['Dot', () => insert('dot(')],['Cross', () => insert('cross(')],['Abs / norm', () => insert('norm(')]]);
    }

    // TABLE: finite ascending range, no more than 30 rows, X memory tracks last row.
    function tableInput() {
      input('f(X) =', tableSpec.expression, expression => {
        if (/\b(?:pol|rec|integral|derivative|sum|summation)\s*\(/i.test(expression)) error('Pol/Rec and calculus unavailable in TABLE', 'Syntax ERROR');
        const draft = { ...tableSpec, expression };
        sequence([{label:'Start?',initial:draft.start},{label:'End?',initial:draft.end},{label:'Step?',initial:draft.step}], values => {
          [draft.start,draft.end,draft.step] = values;
          if (draft.end <= draft.start || draft.step <= 0) error('End must be greater than Start; Step must be positive');
          if (Math.floor((draft.end - draft.start) / draft.step + 1e-10) + 1 > 30) error('TABLE maximum 30 rows', 'Insufficient MEM');
          const frozen = { ...scope() };
          const rows = alg.table(x => real(evaluate(expression,{...frozen,X:x})),draft.start,draft.end,draft.step);
          tableSpec = draft; tableRows = rows; scope().X = rows[rows.length - 1].x;
          tableMenu();
        });
      });
    }
    function tableMenu() { menu('TABLE   X       f(X)', tableRows.map((row,i) => [(i + 1) + ': ' + fmt(row.x) + '  ' + fmt(row.y), () => value(row.y,'X=' + fmt(row.x) + ' · f(X)')])); }

    // BASE-N delegates signed 16-bit BIN / 32-bit other-radix operations.
    const radix = () => ({DEC:10,HEX:16,BIN:2,OCT:8,dec:10,hex:16,bin:2,oct:8})[state().base] || Number(state().base) || 10;
    const radixName = base => ({2:'bin',8:'oct',10:'dec',16:'hex'})[base];
    function baseDisplay(result, base) {
      const output = result[radixName(base)];
      if (output === null) error('Value outside signed 16-bit BIN range');
      const padded = base === 10 ? output : output.padStart(base === 2 ? 16 : base === 8 ? 11 : 8, '0');
      api.showValue(padded, radixName(base).toUpperCase());
      scope().Ans = result.value;
    }
    function baseEquals() {
      const ans = Number(scope().Ans || 0);
      const expression = api.getExpression().replace(/\bAns\b/g, '(' + (ans < 0 ? '-d' + Math.abs(ans) : 'd' + ans) + ')');
      const result = alg.baseCalc(expression, radix());
      state().baseResult = result; baseDisplay(result,radix());
    }
    function changeBase(base) {
      const old = state().baseResult;
      if (old && old[radixName(base)] === null) error('Value outside signed 16-bit BIN range');
      state().base = base;
      if (old) { api.setExpression(old[radixName(base)]); baseDisplay(old,base); }
      else { api.setExpression(''); api.closeMenu(); api.announce(radixName(base).toUpperCase()); }
    }
    function baseMenu() {
      menu('BASE', [['and',() => insert(' and ')],['or',() => insert(' or ')],['xor',() => insert(' xor ')],['xnor',() => insert(' xnor ')],['Not(',() => insert('not(')],['Neg(',() => insert('neg(')],...['d','h','b','o'].map(prefix => [prefix,() => insert(prefix)])],{pageSize:6});
    }

    function scalarVariables(expression, omit = []) {
      const tokens = expression.match(/[A-Za-z][A-Za-z0-9_]*/g) || [];
      const names = tokens.flatMap(token => /^[ABCDEFXYM]+i?$/.test(token) ? token.split('') : [token]);
      return [...new Set(names.filter(name => /^[ABCDEFXYM]$/.test(name) && !omit.includes(name)))];
    }
    function statements(expression) {
      let depth = 0, start = 0; const parts = [];
      for (let i = 0; i < expression.length; i++) {
        if ('(['.includes(expression[i])) depth++;
        if (')]'.includes(expression[i])) depth--;
        if (expression[i] === ':' && depth === 0) { parts.push(expression.slice(start,i)); start = i + 1; }
      }
      parts.push(expression.slice(start));
      if (parts.some(part => !part.trim())) error('Empty statement', 'Syntax ERROR');
      return parts;
    }
    function calc() {
      if (!['COMP','CMPLX'].includes(state().mode)) error('CALC available in COMP / CMPLX');
      const expression = api.getExpression().trim() || lastCalc;
      if (!expression) error('Enter an expression before CALC', 'Syntax ERROR');
      const parts = statements(expression).map(statement => {
        const arrow = statement.match(/^(.*?)(?:→|->)\s*([ABCDEFXYM])\s*$/);
        const equality = statement.match(/^\s*([ABCDEFXYM])\s*=(?!=)(.+)$/);
        return { label: statement.trim(), expression: arrow ? arrow[1] : equality ? equality[2] : statement, assigned: arrow ? arrow[2] : equality ? equality[1] : null };
      });
      const alreadyAssigned = new Set(), names = [];
      for (const part of parts) {
        for (const name of scalarVariables(part.expression)) if (!alreadyAssigned.has(name) && !names.includes(name)) names.push(name);
        if (part.assigned) alreadyAssigned.add(part.assigned);
      }
      sequence(names.map(name => ({label:name + '?',initial:scope()[name] ?? 0,complex:state().mode === 'CMPLX'})), numbers => {
        const draft = { ...scope() }; names.forEach((name,i) => { draft[name] = numbers[i]; });
        const results = [];
        for (const part of parts) {
          const answer = evaluate(part.expression,draft);
          if (part.assigned) draft[part.assigned] = answer;
          draft.Ans = answer; results.push({label:part.label,value:answer});
        }
        Object.assign(scope(),draft); lastCalc = expression; answers = results; answersKind = 'calc'; answerIndex = 0; showAnswer();
      });
    }
    function solve() {
      if (state().mode !== 'COMP') error('SOLVE available in COMP');
      const expression = api.getExpression().trim() || lastSolve;
      if (!expression) error('Enter an equation before SOLVE','Syntax ERROR');
      const variableMatch = expression.match(/,\s*([ABCDEFXYM])\s*$/);
      const variable = variableMatch ? variableMatch[1] : 'X';
      const equationText = variableMatch ? expression.slice(0,variableMatch.index) : expression;
      if (/\b(?:pol|rec|integral|derivative|sum|summation)\s*\(/i.test(equationText)) error('Function unavailable in SOLVE','Syntax ERROR');
      const equal = equationText.split('=');
      if (equal.length > 2 || equal.some(s => !s.trim())) error('One equation is required','Syntax ERROR');
      const source = equal.length === 2 ? '(' + equal[0] + ')-(' + equal[1] + ')' : equal[0];
      const names = scalarVariables(source,[variable]);
      sequence([...names.map(name => ({label:name + '?',initial:scope()[name] ?? 0})),{label:'Solve ' + variable + '; initial ' + variable + '?',initial:scope()[variable] ?? 0}], values => {
        const draft = { ...scope() }; names.forEach((name,i) => { draft[name] = values[i]; });
        const result = alg.solve(x => real(evaluate(source,{...draft,[variable]:x})),values[values.length - 1]);
        draft[variable] = result.root;
        const residual = real(evaluate(source,draft));
        Object.assign(scope(),draft); lastSolve = expression;
        answers = [{label:variable + '=',value:result.root},{label:'L−R=',value:residual}]; answersKind = 'solve'; answerIndex = 0; showAnswer();
      });
    }
    function complexMenu() {
      const override = format => { if (api.setResultFormat) api.setResultFormat(format); else { state().resultComplex = format; api.closeMenu(); } };
      menu('CMPLX', [['arg(',() => insert('arg(')],['Conjg(',() => insert('conj(')],['r∠θ',() => override('polar')],['a+bi',() => override('rect')]]);
    }

    function enter(mode) {
      mode = String(mode).toUpperCase();
      if (!['COMP','CMPLX','STAT','BASE-N','EQN','MATRIX','TABLE','VECTOR'].includes(mode)) error('Unknown mode','Argument ERROR');
      if (activeMode === 'STAT' && mode !== 'STAT') { stats().rows = []; }
      activeMode = mode; state().mode = mode; answers = null;
      if (mode === 'STAT') statType();
      else if (mode === 'BASE-N') { state().base = 10; state().baseResult = null; api.setExpression(''); api.closeMenu(); }
      else if (mode === 'EQN') equationMenu();
      else if (mode === 'MATRIX') variableMenu('Mat',name => dimension('Mat',name));
      else if (mode === 'VECTOR') variableMenu('Vct',name => dimension('Vct',name));
      else if (mode === 'TABLE') tableInput();
      else api.closeMenu();
    }
    function handleKey(key, mods = {}) {
      key = String(key).toUpperCase();
      const mode = state().mode;
      if (key === 'CALC' || key === 'SOLVE') { key === 'SOLVE' || mods.shift ? solve() : calc(); return true; }
      if (mods.shift && key === '1' && mode === 'STAT') { statMenu(); return true; }
      if (mods.shift && key === '2' && mode === 'CMPLX') { complexMenu(); return true; }
      if (mods.shift && key === '3' && mode === 'BASE-N') { baseMenu(); return true; }
      if (mods.shift && key === '4' && mode === 'MATRIX') { matrixMenu(); return true; }
      if (mods.shift && key === '5' && mode === 'VECTOR') { vectorMenu(); return true; }
      if (mode === 'BASE-N' && ['DEC','HEX','BIN','OCT'].includes(key)) { changeBase({DEC:10,HEX:16,BIN:2,OCT:8}[key]); return true; }
      if (mode === 'BASE-N' && ['=','EQUALS','ENTER'].includes(key)) { baseEquals(); return true; }
      if (answers) {
        if (['=','EQUALS','ENTER','DOWN','RIGHT','UP','LEFT'].includes(key)) {
          const back = ['UP','LEFT'].includes(key);
          if (!back && answerIndex + 1 === answers.length && ['=','EQUALS','ENTER'].includes(key)) {
            const kind = answersKind; answers = null;
            if (kind === 'eqn') equationInput(); else if (kind === 'calc') calc(); else solve();
          }
          else { answerIndex = (answerIndex + (back ? -1 : 1) + answers.length) % answers.length; showAnswer(); }
          return true;
        }
        if (key === 'AC') { answers = null; if (mode === 'EQN') { equationInput(); return true; } }
        else if (!mods.shift) answers = null;
      }
      if (mode === 'TABLE' && key === 'AC') { tableInput(); return true; }
      return false;
    }
    function handleContextKey(key, mods = {}, context) {
      if (state().mode !== 'STAT' || !context || !mods.shift || String(key) !== '1') return false;
      if ((context.type === 'input' && /^(?:X|Y|FREQ)\[\d+\]/.test(context.title)) || (context.type === 'menu' && /^(?:STAT Data|Row \d)/.test(context.title))) { statEditorMenu(); return true; }
      return false;
    }
    return { enter, handleKey, handleContextKey, getStatus: () => state().mode === 'STAT' ? (types.find(t => t[1] === stats().type)?.[0] || 'STAT') + ' n=' + stats().rows.length : state().mode === 'BASE-N' ? radixName(radix()).toUpperCase() : state().mode, resetTable: () => { tableSpec = { expression: '', start: 1, end: 5, step: 1 }; tableRows = []; }, exit: () => { answers = null; api.closeMenu(); } };
  }
  root.createDeviceModes = createDeviceModes;
  if (typeof module !== 'undefined' && module.exports) module.exports = { createDeviceModes };
})(typeof window !== 'undefined' ? window : globalThis);

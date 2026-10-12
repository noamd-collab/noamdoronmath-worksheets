# -*- coding: utf-8 -*-
u"""kit.py -- helpers of the G9-KITE package.

One definition per item holds the printed text, the key line, the private find
target and the metrics flags; `Level.q()` turns them into the dicts the skill's
builder takes, so the sheet and its key are produced from one object.

A quotient is printed as a STACKED FRACTION, never with the ASCII colon:
G42-render rejects `a : b` and reserves it for a sheet whose topic is operator
precedence. Grouping is then carried by the bar itself, which is what makes a
precedence question askable without ambiguity.

Math lives inside `$...$` islands and `\\f{a}{b}` is the stacked fraction, so a
bare U+2212 is never laid out after its digit in a Hebrew line.
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

TOOLS = [
         "g9.kite.1",
         "g9.kite.2",
         "g9.kite.3"
]

MN = u"\u2212"            # U+2212, the minus of a number


def fr(a, b):
    return u"\\f{%s}{%s}" % (a, b)


def ng(x):
    return u"(%s%s)" % (MN, x)


def ps(x):
    return u"(+%s)" % x


def dv(a, b):
    u"""a quotient -- the stacked fraction, for the reason in the header"""
    return fr(a, b)


def pr(*xs):
    return u" \u00b7 ".join(xs)


def M(*parts):
    return u"$" + u"".join(parts) + u"$"


def DID():
    return dict(hint_type="guiding_question", exposure=0,
                requires_human_review=False, allowed_tools=list(TOOLS),
                aux_allowed=False, forbidden_to_show=[])


def fd(quantity, of=None, value=None, what=None, unit=None):
    d = {"type": "find", "quantity": quantity, "value": value}
    for k, v in (("of", of), ("what", what), ("unit", unit)):
        if v is not None:
            d[k] = v
    assert value is not None and str(value).strip(), (quantity, what)
    return d


def V(what, value, unit=None):
    return fd("value", what=what, value=value, unit=unit)


def I(label, text, key, find, space=36, imm=False, on=(), make=(), given=()):
    assert find, "every item declares a find target: %s" % label
    it = dict(label=label, text=text, space=space, given=list(given),
              to_prove=list(find), to_construct=list(make), didactic=DID())
    it["_key"] = key
    it["_imm"] = bool(imm)
    it["_on"] = list(on)
    return it


class Level(object):
    def __init__(self, key):
        self.key = key
        self.questions = []
        self.answers = []
        self.meta = {}
        self.stars = set()

    def q(self, n, intro, items, star=False, example=None, fig=None,
          fig_side=None, table=None, given=(), keep=False):
        d = dict(n=n, intro=intro, given=list(given), to_prove=[])
        if star:
            d["star"] = True
            self.stars.add(n)
        if keep:
            d["keep"] = True
        if example is not None:
            d["example"] = example
        if fig is not None:
            d["fig"] = fig
            if fig_side is not None:
                d["fig_side"] = fig_side
        if table is not None:
            d["table"] = table
        rows, labels = [], []
        for it in items:
            it = dict(it)
            key = it.pop("_key")
            imm = it.pop("_imm")
            on = it.pop("_on")
            labels.append(it["label"])
            for lab in on:
                assert lab in labels[:-1], ("an item can only lean on an "
                                            "earlier one", self.key, n,
                                            it["label"], lab)
            self.meta["%s%d%s" % (self.key, n, it["label"])] = dict(
                imm=imm, on=on)
            rows.append((it["label"], key))
            d.setdefault("items", []).append(it)
        self.questions.append(d)
        self.answers.append((n, rows, True) if star else (n, rows))
        return d

    def level_dict(self, **kw):
        assert [q["n"] for q in self.questions] == list(
            range(1, len(self.questions) + 1))
        L = dict(key=self.key, questions=self.questions, answers=self.answers)
        L.update(kw)
        return L

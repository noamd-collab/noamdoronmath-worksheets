# -*- coding: utf-8 -*-
u"""G9-KITE level b -- רמה ב׳, guided.

Written from the approved curriculum blueprint WRITER_VIEW_G9-KITE.json only;
there is no source PDF. Every figure is a native figkit drawing computed from
the question's own numbers in DATA units, scaled uniformly; the replay source
is self-contained (this module's _draw), so figures/<id>.py needs no import
of this level.
"""
import inspect
import math

from kit import Level, I, V, fd

# ---------------------------------------------------------------- figures --


def _draw(spec, replay=True):
    u"""Exact native figure: points in DATA units, scaled uniformly."""
    import figkit
    import export
    pts = spec["points"]
    span = max(max(p[i] for p in pts.values()) - min(p[i] for p in pts.values())
               for i in (0, 1))
    k = spec.get("size", 190) / span
    Q = dict((n, (p[0] * k, -p[1] * k)) for n, p in pts.items())
    g = figkit.Figure()
    g.ex.set_data(lambda p: (p[0] / k, -p[1] / k))
    for n, p in sorted(Q.items()):
        g.ex.name_point(p, n)
    for names in spec.get("polygons", []):
        g.poly([Q[n] for n in names])
    for s in spec.get("segments", []):
        g.line(Q[s[0]], Q[s[1]])
    for n, p in sorted(Q.items()):
        g.label(p, n, size=14, kind="vertex",
                prefer=spec.get("prefer", {}).get(n))
    for s, t in spec.get("labels", []):
        g.edge_label(Q[s[0]], Q[s[1]], t, size=13)
    for s in spec.get("right", []):
        g.right_angle(Q[s[1]], Q[s[0]], Q[s[2]])
    if replay:
        src = (u"import inspect\n" + inspect.getsource(_draw)
               + u"\nsvg = _draw(%r, replay=False)\n" % (spec,))
        with export.replay(src):
            return g.render(fam=spec["fam"])
    return g.render(fam=spec["fam"])


def _r(x):
    return round(x, 9)


def kite_pts(p, q, s, rot=0.0, names="ABCD", center="O", shift=(0.0, 0.0)):
    u"""Convex kite. Heads names[0] and names[2] lie on the main diagonal at
    distances p and q from its foot; the secondary diagonal has half-length
    s. rot turns the main diagonal, shift moves the whole kite."""
    a, b, c, d = names
    t = math.radians(rot)
    cs, sn = math.cos(t), math.sin(t)

    def R(x, y):
        return (_r(x * cs - y * sn + shift[0]), _r(x * sn + y * cs + shift[1]))
    out = {a: R(-p, 0), c: R(q, 0), b: R(0, s), d: R(0, -s)}
    if center:
        out[center] = R(0, 0)
    return out


def fig(points, fam, polygons=("ABCD",), segments=(), labels=(), right=(),
        size=None, prefer=None):
    spec = dict(points=dict(points), polygons=list(polygons),
                segments=list(segments), labels=list(labels),
                right=list(right), fam=fam)
    if size:
        spec["size"] = size
    if prefer:
        spec["prefer"] = prefer
    return _draw(spec)


def _lerp(P, Q, t):
    return (_r(P[0] + (Q[0] - P[0]) * t), _r(P[1] + (Q[1] - P[1]) * t))


# ------------------------------------------------------------ claim dicts --
def sh(kind, pts):
    return dict(type="shape", points=list(pts), value=kind)


def seg(s):
    return dict(type="segment", of=s)


def poly(s):
    return dict(type="polygon", points=list(s))


def pnt(n):
    return dict(type="point", point=n)


def eq(a, b):
    return dict(type="equal_length", of=[a, b])


def perp(a, b):
    return dict(type="perpendicular", of=[a, b])


def par(a, b):
    return dict(type="parallel", of=[a, b])


def mid(p, s):
    return dict(type="midpoint", point=p, of=list(s))


def ln(s, v):
    return dict(type="length", of=s, value=v)


def an(s, v):
    return dict(type="angle", at=s[1], rays=[s[0], s[2]], value=v)


def aeq(a, b):
    return dict(type="equal_angle", of=[a, b])


def col(s):
    return dict(type="collinear", points=list(s))


CM = u"ס״מ"
CM2 = u"סמ״ר"
DEG = u"מעלות"


def Ln(s, v, unit=CM):
    return fd("length", of=s, value=str(v), unit=unit)


def Ang(s, v):
    return fd("angle", of=s, value=str(v), unit=DEG)


def Area(s, v, unit=CM2):
    return fd("area", of=s, value=str(v), unit=unit)


def Per(s, v, unit=CM):
    return fd("perimeter", of=s, value=str(v), unit=unit)


WORDS = {}
WORDS_WHY = u"בנייה מנתונים מילוליים, ללא איור נתון, עם מקום ריק לשרטוט"


def words(q, constraints, room=215):
    u"""Drawing from words: no figure; the conditions belong to what the
    student constructs; the last item keeps a blank drawing room."""
    q["to_construct"] = list(constraints)
    q["given"] = []
    q["items"][-1]["space"] = room
    WORDS[q["n"]] = WORDS_WHY
    return q


def tan(d):
    return math.tan(math.radians(d))


# ------------------------------------------------------------------ level --
l = Level("b")

# Q1 -- table: definition, head vertices, the one-shared-side trap, rhombus
l.q(1, u"בטבלה אורכי הצלעות של חמישה מרובעים קמורים $ABCD$, בסנטימטרים. הצלעות רשומות לפי סדרן סביב המרובע.", [
    I(u"א", u"אילו מן המרובעים הם דלתונים לפי ההגדרה שבראש הדף?",
      u"מרובעים 1, 3 ו־4 הם דלתונים. במרובע 1: $AB=BC$ וגם $CD=DA$. במרובע 4: $DA=AB$ וגם $BC=CD$. במרובע 3 כל הצלעות שוות, וגם מעוין הוא דלתון.",
      [V(u"הדלתונים", u"1, 3, 4")]),
    I(u"ב", u"במרובע 1 רשמו את שני קודקודי הראש ואת האלכסון הראשי.",
      u"קודקודי הראש הם הקודקודים שבין הצלעות השוות: $B$ ו־$D$. האלכסון הראשי הוא $BD$.",
      [V(u"קודקודי הראש והאלכסון הראשי", u"B, D; BD")], on=(u"א",)),
    I(u"ג", u"תלמיד כתב: ״מרובע 5 הוא דלתון, כי $AB=BC$ וגם $BC=CD$״. הסבירו את הטעות.",
      u"שני הזוגות חולקים את הצלע $BC$, ולכן אינם זוגות נפרדים. הזוג השני הנדרש, $CD$ ו־$DA$ או $DA$ ו־$AB$, אינו שווה, כי 4 שונה מ־9; לכן מרובע 5 אינו דלתון.",
      [V(u"אבחון הטעות", u"הזוגות אינם נפרדים; DA שונה")]),
    I(u"ד", u"במרובע 3 אפשר לבחור את זוגות הצלעות בשתי דרכים. רשמו בכל דרך מהו האלכסון הראשי.",
      u"זוגות ב־$A$ וב־$C$ נותנים אלכסון ראשי $AC$; זוגות ב־$B$ וב־$D$ נותנים $BD$. במעוין כל אחד מן האלכסונים הוא ראשי.",
      [V(u"שני האלכסונים הראשיים", u"AC; BD")], on=(u"א",)),
], table={"head": [u"מרובע", "AB", "BC", "CD", "DA"],
          "rows": [["1", "5", "5", "8", "8"], ["2", "6", "9", "6", "9"],
                   ["3", "7", "7", "7", "7"], ["4", "11", "4", "4", "11"],
                   ["5", "4", "4", "4", "9"]]})

# Q2 -- head angles bisected, side angles equal; worked example
P = kite_pts(4 / tan(42), 4 / tan(58), 4, rot=-60, center=None)
l.q(2, u"בדלתון $ABCD$ נתון $AB=AD$ ו־$CB=CD$. האלכסון הראשי $AC$ מצויר. נתון $∠BAD=84°$ ו־$∠BCD=116°$.", [
    I(u"א", u"חשבו את $∠ABC$.",
      u"זוויות הצד שוות: $∠ABC=∠ADC$. סכום הזוויות במרובע $360°$, ולכן $360−84−116=160$ ו־$∠ABC=80°$.",
      [Ang("ABC", 80)]),
    I(u"ב", u"חשבו את $∠BAC$ ואת $∠ACD$.",
      u"האלכסון הראשי חוצה את זוויות הראש: $∠BAC=42°$ ו־$∠ACD=58°$.",
      [Ang("BAC", 42), Ang("ACD", 58)]),
    I(u"ג", u"חשבו את $∠ADC$ בדרך אחרת, מתוך המשולש $△ACD$, והשוו לתוצאה של סעיף א.",
      u"ב־$△ACD$: $∠CAD=42°$ ו־$∠ACD=58°$, ולכן $∠ADC=180−42−58=80°$, כמו $∠ABC$.",
      [Ang("ADC", 80)], on=(u"ב",)),
], fig=fig(P, "quad.kite+main-diagonal", segments=["AC"]),
    given=[eq("AB", "AD"), eq("CB", "CD"), an("BAD", 84), an("BCD", 116)],
    example=(u"דוגמה פתורה", [
        u"בדלתון שזוויות הראש שלו $96°$ ו־$40°$, סכום שתי זוויות הצד הוא $360°−96°−40°$, כלומר $224°$. זוויות הצד שוות, ולכן כל אחת מהן $112°$."]))

# Q3 -- the core theorem, guided proof
P = kite_pts(3, 8, 4, rot=110, names="KLMN", center="P")
l.q(3, u"בדלתון $KLMN$ נתון $KL=KN$ ו־$ML=MN$. האלכסונים $KM$ ו־$LN$ נפגשים בנקודה $P$.", [
    I(u"א", u"הוכיחו כי $△KLM≅△KNM$.",
      u"$KL=KN$ ו־$ML=MN$ נתונים, ו־$KM$ צלע משותפת. לכן המשולשים חופפים לפי צ.צ.צ.",
      [V(u"חפיפה", u"△KLM≅△KNM לפי צ.צ.צ")], space=44),
    I(u"ב", u"הסיקו כי $KM$ חוצה את $∠LKN$ ואת $∠LMN$.",
      u"מן החפיפה, זוויות מתאימות שוות: $∠LKM=∠NKM$ ו־$∠LMK=∠NMK$.",
      [aeq("LKM", "NKM"), aeq("LMK", "NMK")], on=(u"א",)),
    I(u"ג", u"היעזרו במשולשים $△KLP$ ו־$△KNP$ והוכיחו כי $KM⊥LN$ וגם $LP=PN$.",
      u"$KL=KN$, $∠LKP=∠NKP$ מסעיף ב, ו־$KP$ משותפת; חפיפה לפי צ.ז.צ. לכן $LP=PN$, וגם $∠KPL=∠KPN$. שתי הזוויות צמודות, ולכן כל אחת $90°$.",
      [perp("KM", "LN"), eq("LP", "PN")], on=(u"ב",), space=50),
], fig=fig(P, "quad.kite+both-diagonals", polygons=["KLMN"],
           segments=["KM", "LN"]),
    given=[eq("KL", "KN"), eq("ML", "MN"), col("KPM"), col("LPN")])

# Q4 -- Pythagoras in two right triangles; worked example
P = kite_pts(10, 18, 24, rot=0, center=None)
l.q(4, u"בדלתון $ABCD$ נתון $AB=AD=26$ ס״מ ו־$CB=CD=30$ ס״מ. האלכסון המשני $BD$ מצויר, ואורכו $48$ ס״מ.", [
    I(u"א", u"העבירו את האלכסון $AC$ וסמנו ב־$O$ את מפגש האלכסונים. מצאו את $BO$ ונמקו.",
      u"האלכסון הראשי $AC$ חוצה את האלכסון המשני, ולכן $BO$ הוא מחצית $BD$, כלומר $24$ ס״מ.",
      [Ln("BO", 24)], make=[seg("AC"), pnt("O")]),
    I(u"ב", u"חשבו את $AO$ ואת $CO$.",
      u"$AC⊥BD$. ב־$△AOB$: $AO^2=26·26−24·24=100$, ולכן $AO=10$ ס״מ. ב־$△COB$: $CO^2=30·30−24·24=324$, ולכן $CO=18$ ס״מ.",
      [Ln("AO", 10), Ln("CO", 18)], on=(u"א",)),
    I(u"ג", u"חשבו את שטח הדלתון.",
      u"$AC$ הוא $10+18$, כלומר $28$ ס״מ. השטח $\\f{28·48}{2}$, כלומר $672$ סמ״ר.",
      [Area("ABCD", 672)], on=(u"ב",)),
], fig=fig(P, "quad.kite+secondary-diagonal", segments=["BD"]),
    given=[eq("AB", "AD"), eq("CB", "CD"), ln("AB", 26), ln("CB", 30),
           ln("BD", 48)],
    example=(u"דוגמה פתורה", [
        u"בדלתון שבו צלע אחת $5$ ס״מ ומחצית האלכסון המשני $4$ ס״מ: לפי פיתגורס ריבוע הקטע שבין קודקוד הראש למפגש האלכסונים הוא $5·5−4·4$, כלומר 9, ולכן אורך הקטע הוא $3$ ס״מ, כי ריבוע של 3 הוא 9 והאורך חיובי."]))

# Q5 -- error correction: the secondary diagonal does not bisect the main one
P = kite_pts(6, 15, 10, rot=75, names="EFGH", center="T")
l.q(5, u"בדלתון $EFGH$ נתון $EF=EH$ ו־$GF=GH$. האלכסונים $EG$ ו־$FH$ נפגשים ב־$T$. נתון $FH=20$ ס״מ, $ET=6$ ס״מ ו־$TG=15$ ס״מ.", [
    I(u"א", u"תלמיד כתב: ״האלכסונים חוצים זה את זה, ולכן $EG$ ארוך פי שניים מ־$ET$״. מצאו את הטעות.",
      u"הדלתון אינו מעוין, ולכן רק האלכסון הראשי $EG$ חוצה את המשני $FH$: $T$ אמצע $FH$, אך אינה אמצע $EG$, כי $ET$ ו־$TG$ שונים.",
      [V(u"הטעות", u"המשני אינו חוצה את הראשי")]),
    I(u"ב", u"חשבו את אורכו הנכון של $EG$ ואת שטח הדלתון.",
      u"$EG$ הוא $6+15$, כלומר $21$ ס״מ. השטח $\\f{21·20}{2}$, כלומר $210$ סמ״ר.",
      [Ln("EG", 21), Area("EFGH", 210)], on=(u"א",)),
    I(u"ג", u"באיזה סוג של דלתון החישוב של התלמיד היה נכון? נמקו.",
      u"במעוין: שם כל אחד מן האלכסונים ראשי, ולכן הם חוצים זה את זה ו־$ET=TG$.",
      [V(u"מקרה מיוחד", u"מעוין")], on=(u"א",)),
], fig=fig(P, "quad.kite+both-diagonals", polygons=["EFGH"],
           segments=["EG", "FH"]),
    given=[eq("EF", "EH"), eq("GF", "GH"), ln("FH", 20), ln("ET", 6),
           ln("TG", 15), col("ETG"), col("FTH")])

# Q6 -- converse: the perpendicular bisector of a segment
P = kite_pts(7, 3, 4, rot=-120)
l.q(6, u"הקטע $AC$ מאונך לקטע $BD$ בנקודה $O$, כלומר $AO⊥BO$, ו־$O$ אמצע $BD$. הנקודות $A$ ו־$C$ נמצאות משני צדי $BD$.", [
    I(u"א", u"הוכיחו כי $AB=AD$.",
      u"ב־$△AOB$ וב־$△AOD$: $BO=OD$, $∠AOB=∠AOD=90°$, ו־$AO$ משותפת. חפיפה לפי צ.ז.צ, ולכן $AB=AD$.",
      [eq("AB", "AD")], space=44),
    I(u"ב", u"הוכיחו כי $CB=CD$, והסיקו ש־$ABCD$ דלתון.",
      u"באותה דרך $△COB≅△COD$ לפי צ.ז.צ, ולכן $CB=CD$. יש שני זוגות נפרדים של צלעות סמוכות שוות, ולכן $ABCD$ דלתון.",
      [eq("CB", "CD"), sh("kite", "ABCD")], on=(u"א",)),
    I(u"ג", u"נניח שהיה נתון רק $AC⊥BD$, בלי ש־$O$ אמצע $BD$. האם עדיין אפשר להסיק ש־$AB=AD$? הסבירו.",
      u"לא. אם $O$ קרובה יותר ל־$B$, אז ב־$△AOB$ וב־$△AOD$ הניצב $AO$ משותף והניצב $BO$ קצר מ־$DO$, ולכן $AB$ קצר מ־$AD$. נדרשים גם הניצבות וגם החצייה.",
      [V(u"ניצבות בלבד", u"לא; נדרשת גם חצייה")]),
], fig=fig(P, "quad.kite-converse+perpendicular-bisector",
           segments=["AC", "BD"], right=["AOB"]),
    given=[perp("AC", "BD"), dict(type="perpendicular", at="O", of=["AO", "BO"]),
           mid("O", "BD"), col("AOC"), col("BOD")])

# Q7 -- algebra on the sides, perimeter, reconstruction
P = kite_pts(math.sqrt(72), math.sqrt(120), 7, rot=20, names="RSTU", center=None)
l.q(7, u"בדלתון $RSTU$ נתון $RS=RU$ ו־$TS=TU$. נתון $RS=2x+1$, $RU=x+6$ ו־$TS=3x−2$, כל האורכים בס״מ.", [
    I(u"א", u"מצאו את $x$.",
      u"$RS=RU$, ולכן $2x+1=x+6$ ומכאן $x=5$",
      [V("x", "5")]),
    I(u"ב", u"חשבו את היקף הדלתון.",
      u"$RS$ ו־$RU$ הן $11$ ס״מ, $TS$ ו־$TU$ הן $13$ ס״מ. ההיקף $2·11+2·13$, כלומר $48$ ס״מ.",
      [Per("RSTU", 48)], on=(u"א",)),
    I(u"ג", u"דנה טוענת שאפשר לבחור ערך אחר של $x$ ולקבל דלתון עם אותם ביטויים וההיקף $60$ ס״מ. האם היא צודקת? נמקו.",
      u"לא. השוויון $RS=RU$ מחייב $x=5$ בלבד, ולכן ההיקף נקבע: $48$ ס״מ.",
      [V(u"היתכנות", u"לא; x נקבע ולכן ההיקף 48")], on=(u"א",)),
], fig=fig(P, "quad.kite", polygons=["RSTU"]),
    given=[eq("RS", "RU"), eq("TS", "TU"),
           u"אורכי הצלעות בס״מ: RS=2x+1, RU=x+6, TS=3x−2"])

# Q8 -- area formula through the secondary diagonal as a common base
P = kite_pts(4, 11, 5, rot=-25)
l.q(8, u"בדלתון $ABCD$ נתון $AB=AD$ ו־$CB=CD$. האלכסונים $AC$ ו־$BD$ נפגשים ב־$O$. נתון $AO=4$ ס״מ, $OC=11$ ס״מ ו־$BD=10$ ס״מ.", [
    I(u"א", u"חשבו את שטח המשולש $△ABD$ ואת שטח המשולש $△CBD$.",
      u"האלכסון הראשי מאונך למשני, ולכן $AO$ הגובה לבסיס $BD$ ב־$△ABD$, ו־$CO$ הגובה לבסיס $BD$ ב־$△CBD$. השטחים: $\\f{10·4}{2}$, כלומר $20$ סמ״ר, ו־$\\f{10·11}{2}$, כלומר $55$ סמ״ר.",
      [Area("ABD", 20), Area("CBD", 55)]),
    I(u"ב", u"הראו ששטח הדלתון שווה למחצית מכפלת האלכסונים, וחשבו אותו.",
      u"שטח הדלתון $\\f{BD·AO}{2}+\\f{BD·CO}{2}$, כלומר $\\f{BD·AC}{2}$, כי $AO+CO$ הוא $AC$. כאן $\\f{10·15}{2}$, כלומר $75$ סמ״ר.",
      [Area("ABCD", 75)], on=(u"א",)),
    I(u"ג", u"לדלתון אחר שטח $60$ סמ״ר ואלכסון אחד באורך $8$ ס״מ. חשבו את אורך האלכסון האחר.",
      u"מכפלת האלכסונים כפולה מן השטח, והיא $120$, ולכן האלכסון האחר $\\f{120}{8}$, כלומר $15$ ס״מ.",
      [V(u"האלכסון האחר", u"15", CM)], on=(u"ב",)),
], fig=fig(P, "quad.kite+both-diagonals", segments=["AC", "BD"]),
    given=[eq("AB", "AD"), eq("CB", "CD"), ln("AO", 4), ln("OC", 11),
           ln("BD", 10), col("AOC"), col("BOD")])

# Q9 -- words: construction from the diagonals, symmetry, not a rhombus
q = l.q(9, u"שרטטו דלתון $ABCD$ שבו אורך האלכסון הראשי $AC$ הוא $10$ ס״מ, אורך האלכסון המשני $BD$ הוא $8$ ס״מ, והאלכסונים נפגשים בנקודה $O$ שמקיימת $AO=3$ ס״מ.", [
    I(u"א", u"כתבו סדר בנייה: היכן על $AC$ עובר $BD$, באיזו זווית, ומדוע $O$ חייבת להיות אמצע $BD$?",
      u"מסמנים $AC$ באורך 10 ס״מ ואת $O$ במרחק 3 ס״מ מ־$A$. דרך $O$ מעבירים ניצב ל־$AC$ ומסמנים עליו את $B$ ואת $D$ במרחק 4 ס״מ משני צדי $O$. האלכסון הראשי מאונך למשני וחוצה אותו.",
      [V(u"סדר בנייה", u"BD מאונך ל־AC ב־O, ו־O אמצע BD")], space=40),
    I(u"ב", u"איזה ישר הוא ציר סימטריה של הדלתון שבניתם, ולאיזו נקודה עוברת $B$ בשיקוף בו?",
      u"הישר $AC$, האלכסון הראשי. $B$ עוברת ל־$D$.",
      [V(u"ציר סימטריה", u"AC; B עוברת ל־D")], on=(u"א",)),
    I(u"ג", u"האם הדלתון שבניתם הוא מעוין? נמקו בעזרת $AO$ ו־$OC$. בנו אותו כאן.",
      u"לא. $OC$ הוא $10−3$, כלומר $7$ ס״מ, שונה מ־$AO$; האלכסונים אינם חוצים זה את זה, ולכן אין זה מעוין.",
      [V(u"מעוין?", u"לא; AO שונה מ־OC")], on=(u"א",),
      make=[poly("ABCD"), seg("AC"), seg("BD")]),
])
words(q, [poly("ABCD"), seg("AC"), seg("BD"), pnt("O"), eq("AB", "AD"),
          eq("CB", "CD"), ln("AC", 10), ln("BD", 8), ln("AO", 3)])

# Q10 -- symmetry axis and a point on the main diagonal
P = kite_pts(math.sqrt(11), math.sqrt(56), 5, rot=-15, center=None)
P["E"] = _lerp(P["A"], P["C"], 0.72)
l.q(10, u"בדלתון $ABCD$ נתון $AB=AD=6$ ס״מ ו־$CB=CD=9$ ס״מ. הנקודה $E$ נמצאת על האלכסון הראשי $AC$.", [
    I(u"א", u"הוכיחו כי $EB=ED$.",
      u"האלכסון הראשי חוצה את זווית הראש: $∠BAE=∠DAE$. ב־$△ABE$ וב־$△ADE$: $AB=AD$, הזוויות שוות ו־$AE$ משותפת; חפיפה לפי צ.ז.צ, ולכן $EB=ED$.",
      [eq("EB", "ED")], space=44),
    I(u"ב", u"מהו ציר הסימטריה של הדלתון? הסבירו בעזרתו, במשפט אחד, את התוצאה של סעיף א.",
      u"הישר $AC$. בשיקוף בו $B$ עוברת ל־$D$ ו־$E$ נשארת במקומה, ולכן $EB$ עובר ל־$ED$ והם שווים.",
      [V(u"ציר סימטריה", u"AC")], on=(u"א",)),
    I(u"ג", u"תלמיד טוען: ״$AC$ ציר סימטריה של הדלתון, ולכן גם זוויות הראש $∠BAD$ ו־$∠BCD$ שוות״. מצאו את הטעות.",
      u"השיקוף ב־$AC$ משאיר את $A$ ואת $C$ במקומן ומחליף בין $B$ ל־$D$. לכן הוא מעביר את $∠ABC$ ל־$∠ADC$ ומוכיח רק שזוויות הצד שוות. זווית הראש $∠BAD$ עוברת לעצמה, ולכן אין מכאן שום קשר בינה לבין $∠BCD$.",
      [V(u"הטעות", u"השיקוף מחליף את B ו־D, לא את A ו־C")], on=(u"ב",)),
], fig=fig(P, "quad.kite+point-on-main-diagonal",
           segments=["AC", "EB", "ED"]),
    given=[eq("AB", "AD"), eq("CB", "CD"), ln("AB", 6), ln("CB", 9),
           col("AEC")])

# Q11 -- words: which data suffice; counterexamples
q = l.q(11, u"במרובע קמור $ABCD$ האלכסונים $AC$ ו־$BD$ נפגשים בנקודה $O$. בכל סעיף נתון מידע אחר. קבעו אם המידע מבטיח ש־$ABCD$ דלתון.", [
    I(u"א", u"נתון רק $AC⊥BD$. אם המידע אינו מספיק, תארו דוגמה נגדית.",
      u"לא מספיק. דוגמה: אלכסונים מאונכים שחלקיהם 1 ו־3 ס״מ על $AC$, ו־2 ו־4 ס״מ על $BD$. אף אלכסון אינו חוצה את האחר, ואין זוג צלעות סמוכות שוות.",
      [V(u"ניצבות בלבד", u"לא מספיק")]),
    I(u"ב", u"נתון $CB=CD$ וגם ש־$O$ אמצע $BD$. היעזרו במשולש $△CBD$ והוכיחו ש־$ABCD$ דלתון.",
      u"ב־$△CBD$ שווה השוקיים, $CO$ תיכון לבסיס ולכן גם גובה: $CO⊥BD$. לכן $AC$ מאונך ל־$BD$ באמצעו. ב־$△AOB$ וב־$△AOD$: $BO=OD$, הזוויות ב־$O$ ישרות ו־$AO$ משותפת; חפיפה לפי צ.ז.צ, ולכן $AB=AD$. שני זוגות נפרדים, ולכן דלתון.",
      [V(u"שוקיים וחצייה", u"מספיק")], space=48),
    I(u"ג", u"נתון רק ש־$O$ אמצע $BD$. קבעו אם המידע מספיק, ובנו כאן דוגמה נגדית אם אינו מספיק.",
      u"לא מספיק. דוגמה: מלבן שאינו ריבוע; אלכסוניו חוצים זה את זה, אבל צלעות סמוכות אינן שוות.",
      [V(u"חצייה בלבד", u"לא מספיק; מלבן שאינו ריבוע")],
      make=[poly("ABCD"), seg("AC"), seg("BD")]),
])
words(q, [poly("ABCD"), seg("AC"), seg("BD"), pnt("O")])

# Q12 -- the rhombus as a special kite
P = kite_pts(5, 5, 3.5, rot=35, names="PQRS", center=None)
l.q(12, u"$PQRS$ הוא מעוין. אורכי אלכסוניו: $PR=10$ ס״מ ו־$QS=7$ ס״מ.", [
    I(u"א", u"המעוין הוא גם דלתון, בשתי דרכים. רשמו לכל דרך את קודקודי הראש.",
      u"כל הצלעות שוות. זוגות ב־$P$ וב־$R$: קודקודי ראש $P$ ו־$R$. זוגות ב־$Q$ וב־$S$: קודקודי ראש $Q$ ו־$S$.",
      [V(u"קודקודי ראש", u"P,R או Q,S")]),
    I(u"ב", u"הסיקו מן המשפט על האלכסון הראשי: איזה אלכסון חוצה את האחר, ואיזה מאונך לאחר?",
      u"כל אחד מן האלכסונים הוא ראשי באחת הדרכים. לכן כל אחד חוצה את האחר, והם מאונכים זה לזה.",
      [V(u"חצייה הדדית", u"כל אחד חוצה את האחר ומאונך לו")], on=(u"א",)),
    I(u"ג", u"חשבו את שטח המעוין.",
      u"$\\f{10·7}{2}$, כלומר $35$ סמ״ר.",
      [Area("PQRS", 35)]),
], fig=fig(P, "quad.rhombus-as-kite+diagonals", polygons=["PQRS"],
           segments=["PR", "QS"]),
    given=[sh("rhombus", "PQRS"), ln("PR", 10), ln("QS", 7)])

# Q13 -- words: build a kite on a perpendicular bisector; rhombus choice
q = l.q(13, u"שרטטו קטע $BD$ באורך $6$ ס״מ ואת האנך האמצעי שלו, הנפגש עם $BD$ בנקודה $O$. סמנו על האנך נקודה $A$ במרחק $4$ ס״מ מ־$O$, ונקודה $C$ בצד השני של $BD$.", [
    I(u"א", u"הסבירו מדוע $ABCD$ דלתון, ורשמו את קודקודי הראש שלו.",
      u"כל נקודה על האנך האמצעי שווה מרחק מ־$B$ ומ־$D$: $AB=AD$ ו־$CB=CD$. קודקודי הראש הם $A$ ו־$C$.",
      [V(u"דלתון", u"AB=AD, CB=CD; ראש A,C")]),
    I(u"ב", u"חשבו את $AB$.",
      u"$BO$ הוא 3 ס״מ ו־$AO⊥BD$. לפי פיתגורס $AB^2=3·3+4·4=25$, ולכן $AB=5$ ס״מ.",
      [Ln("AB", 5)]),
    I(u"ג", u"באיזה מרחק מ־$O$ יש לבחור את $C$ כדי ש־$ABCD$ יהיה מעוין? בנו כאן את הדלתון בבחירה זו ובבחירה אחרת. אפשר לבנות את שניהם על אותו קטע $BD$.",
      u"במרחק $4$ ס״מ: אז $CB=5=AB$ וכל הצלעות שוות. בכל מרחק אחר מתקבל דלתון שאינו מעוין.",
      [V(u"בחירת C למעוין", u"באותו מרחק מ־O כמו A")], on=(u"ב",),
      make=[poly("ABCD")]),
])
words(q, [seg("BD"), pnt("O"), pnt("A"), pnt("C"), perp("AC", "BD"),
          mid("O", "BD"), ln("BD", 6), ln("AO", 4), poly("ABCD")], room=240)

# Q14 -- a toy kite: reading lengths off the figure, area, feasibility
P = kite_pts(27, 48, 36, rot=-90, center=None)
l.q(14, u"עפיפון בנוי בצורת הדלתון $ABCD$. אורכי המסגרת רשומים בשרטוט בס״מ. מוט אחד מחבר את $B$ ל־$D$ ואורכו $72$ ס״מ, ומוט שני מחבר את $A$ ל־$C$.", [
    I(u"א", u"חשבו את אורך המוט $AC$.",
      u"$AC$ חוצה את $BD$ ומאונך לו, ולכן חצי $BD$ הוא 36 ס״מ. ב־$△ABO$: $45·45−36·36=729$, ולכן הקטע מ־$A$ הוא 27 ס״מ. בצד השני: $60·60−36·36=2304$, ולכן הקטע מ־$C$ הוא 48 ס״מ. לכן $AC$ הוא $75$ ס״מ.",
      [Ln("AC", 75)]),
    I(u"ב", u"חשבו את שטח הנייר הדרוש לכיסוי העפיפון.",
      u"$\\f{75·72}{2}$, כלומר $2700$ סמ״ר.",
      [Area("ABCD", 2700)], on=(u"א",)),
    I(u"ג", u"רוצים עפיפון רחב יותר עם אותה מסגרת, שבו המוט המחבר את שני קודקודי הצד ארוך $90$ ס״מ. האם זה אפשרי? נמקו.",
      u"לא. חצי המוט יהיה 45 ס״מ, שווה לצלע הקצרה. במשולש ישר הזווית הניצב קצר מן היתר, ולכן $A$ הייתה נופלת על המוט ואין דלתון.",
      [V(u"היתכנות", u"לא; חצי המוט אינו קצר מן הצלע הקצרה")]),
], fig=fig(P, "quad.kite", labels=[("AB", "45"), ("AD", "45"),
                                   ("BC", "60"), ("CD", "60")], size=200),
    given=[eq("AB", "AD"), eq("CB", "CD"), ln("AB", 45), ln("AD", 45),
           ln("BC", 60), ln("CD", 60), ln("BD", 72)])

# Q15 -- angle algebra
P = kite_pts(3 / tan(25), 3 / tan(55), 3, rot=160, center=None)
l.q(15, u"בדלתון $ABCD$ נתון $AB=AD$ ו־$CB=CD$, והאלכסון הראשי $AC$ מצויר. נתון $∠ABC=3x+10$, $∠ADC=5x−50$ ו־$∠BAD=x+20$, כל הזוויות במעלות.", [
    I(u"א", u"אילו שתיים מן הזוויות הנתונות שוות זו לזו? נמקו.",
      u"$∠ABC$ ו־$∠ADC$: אלה זוויות הצד, והן שוות כי $△ABC≅△ADC$ לפי צ.צ.צ.",
      [V(u"הזוויות השוות", u"∠ABC ו־∠ADC, זוויות הצד")]),
    I(u"ב", u"מצאו את $x$ ואת $∠ABC$.",
      u"$3x+10=5x−50$, ולכן $x=30$ ו־$∠ABC=100°$.",
      [V("x", "30"), Ang("ABC", 100)], on=(u"א",)),
    I(u"ג", u"חשבו את $∠BCD$.",
      u"$∠BAD=50°$. סכום הזוויות במרובע: $360−100−100−50=110$, ולכן $∠BCD=110°$.",
      [Ang("BCD", 110)], on=(u"ב",)),
    I(u"ד", u"חשבו את $∠ACB$.",
      u"האלכסון הראשי חוצה את זווית הראש $∠BCD$, ולכן $∠ACB=55°$.",
      [Ang("ACB", 55)], on=(u"ג",)),
], fig=fig(P, "quad.kite+main-diagonal", segments=["AC"]),
    given=[eq("AB", "AD"), eq("CB", "CD")])

# Q16 -- the sides alone do not fix the area: two kites, same sides
_km = math.sqrt(29 * 29 + 35 * 35)
P = kite_pts(20, 28, 21, rot=90)
P.update(kite_pts(29 * 29 / _km, 35 * 35 / _km, 29 * 35 / _km, rot=90,
                  names="KLMN", center=None, shift=(52.0, 0.0)))
l.q(16, u"שני דלתונים נבנו מאותם ארבעה מוטות: $AB=AD=KL=KN=29$ ס״מ ו־$CB=CD=ML=MN=35$ ס״מ. בדלתון $ABCD$ מצוירים האלכסונים $AC$ ו־$BD$, ואורך $BD$ הוא $42$ ס״מ. בדלתון $KLMN$ מצויר האלכסון $KM$, והזווית $∠KLM$ ישרה.", [
    I(u"א", u"חשבו את שטח הדלתון $ABCD$.",
      u"חצי $BD$ הוא 21 ס״מ. $AO^2=29·29−21·21=400$, ולכן $AO=20$; $CO^2=35·35−21·21=784$, ולכן $CO=28$ ו־$AC$ הוא 48 ס״מ. השטח $\\f{48·42}{2}$, כלומר $1008$ סמ״ר.",
      [Area("ABCD", 1008)]),
    I(u"ב", u"חשבו את שטח הדלתון $KLMN$.",
      u"$△KLM≅△KNM$, והמשולש $△KLM$ ישר זווית עם ניצבים 29 ו־35. לכן שטח הדלתון פעמיים שטחו, כלומר $29·35$, שהם $1015$ סמ״ר.",
      [Area("KLMN", 1015)]),
    I(u"ג", u"האם אורכי הצלעות לבדם קובעים את שטח הדלתון? מה צריך להוסיף כדי לקבוע אותו?",
      u"לא: אותן צלעות נתנו 1008 ו־1015 סמ״ר. צריך נתון נוסף, למשל אורך אלכסון או זווית.",
      [V(u"קביעת השטח", u"לא; נדרש אלכסון או זווית")], on=(u"א", u"ב")),
], fig=fig(P, "compound.two-kites-same-sides", polygons=["ABCD", "KLMN"],
           segments=["AC", "BD", "KM"], right=["KLM"], size=300),
    given=[eq("AB", "AD"), eq("CB", "CD"), eq("KL", "KN"), eq("ML", "MN"),
           ln("AB", 29), ln("CB", 35), ln("KL", 29), ln("ML", 35),
           ln("BD", 42), dict(type="perpendicular", at="L", of=["KL", "LM"]),
           col("AOC"), col("BOD")])

# Q17 -- words: reconstruct from area, plan two kites, the rhombus option
q = l.q(17, u"יש לבנות דלתון שאורך אלכסונו המשני $6$ ס״מ ושטחו $24$ סמ״ר.", [
    I(u"א", u"חשבו את אורך האלכסון הראשי.",
      u"מכפלת האלכסונים כפולה מן השטח, והיא 48, ולכן האלכסון הראשי $\\f{48}{6}$, כלומר $8$ ס״מ.",
      [V(u"האלכסון הראשי", u"8", CM)]),
    I(u"ב", u"נקודת המפגש של האלכסונים מחלקת את האלכסון הראשי לשני קטעים. באיזו חלוקה מתקבל מעוין? רשמו את אורכי הקטעים ונמקו.",
      u"בחלוקה לשני קטעים שווים, $4$ ס״מ כל אחד. אז כל אלכסון חוצה את האחר, הצלעות הסמוכות לשני קודקודי הראש שוות זו לזו, וכל ארבע הצלעות שוות: מעוין.",
      [V(u"קטעי המעוין", u"4 ו־4", CM)], on=(u"א",)),
    I(u"ג", u"בנו כאן שני דלתונים שונים המקיימים את הדרישות, אחד מהם אינו מעוין. אפשר לבנות את שניהם על אותו אלכסון משני. רשמו בכל אחד את אורכי שני הקטעים של האלכסון הראשי.",
      u"כל חלוקה של 8 לשני קטעים חיוביים, והמשני מאונך בנקודת החלוקה ונחצה בה. למשל קטעים של 4 ו־4 ס״מ, מעוין, וגם קטעים של 2 ו־6 ס״מ.",
      [V(u"בנייה", u"שני קטעים חיוביים שסכומם שווה לאלכסון הראשי")], on=(u"א", u"ב"),
      make=[poly("ABCD"), seg("AC"), seg("BD")]),
])
words(q, [poly("ABCD"), seg("AC"), seg("BD"), eq("AB", "AD"), eq("CB", "CD"),
          ln("BD", 6), u"שטח הדלתון 24 סמ״ר"], room=270)

# Q18 -- two isosceles triangles on a common base: collinearity
P = kite_pts(4, 9, 5, rot=-30, center="M")
l.q(18, u"$△ABD$ ו־$△CBD$ הם משולשים שווי שוקיים על הבסיס המשותף $BD$: $AB=AD$ ו־$CB=CD$. הנקודות $A$ ו־$C$ משני צדי $BD$, ו־$M$ אמצע $BD$. הקטעים $AM$ ו־$MC$ מצוירים.", [
    I(u"א", u"הוכיחו כי $AM⊥BD$.",
      u"ב־$△ABD$ שווה השוקיים, $AM$ תיכון לבסיס, ולכן גם גובה לבסיס.",
      [perp("AM", "BD")]),
    I(u"ב", u"הוכיחו כי $CM⊥BD$, והסיקו ש־$A$, $M$ ו־$C$ על ישר אחד.",
      u"באותה דרך ב־$△CBD$. דרך $M$ עובר ניצב יחיד ל־$BD$, ולכן $AM$ ו־$MC$ על אותו ישר.",
      [perp("CM", "BD"), col("AMC")], on=(u"א",)),
    I(u"ג", u"מה מראה התוצאה על האלכסון $AC$ של הדלתון $ABCD$, ומדוע היה צורך להוכיח את סעיף ב לפני כן?",
      u"$AC$ עובר דרך אמצע $BD$ ומאונך לו: האלכסון הראשי חוצה את המשני. בלי סעיף ב לא ידוע ש־$M$ על הקטע $AC$.",
      [V(u"מסקנה", u"AC חוצה את BD ומאונך לו")], on=(u"ב",)),
], fig=fig(P, "compound.two-isosceles-triangles-common-base",
           polygons=["ABD", "CBD"], segments=["AM", "MC"]),
    given=[eq("AB", "AD"), eq("CB", "CD"), mid("M", "BD")])

# Q19 -- table: plan from the perimeter; which secondary diagonal is possible
l.q(19, u"מתכננים דלתון שהיקפו $46$ ס״מ, ובו כל צלע בזוג אחד ארוכה ב־$3$ ס״מ מכל צלע בזוג השני. בטבלה שלוש הצעות לאורך האלכסון המשני.", [
    I(u"א", u"מצאו את אורכי הצלעות.",
      u"אם הצלע הקצרה $a$, אז $2a+2·(a+3)=46$, כלומר $4a+6=46$ ו־$a=10$. הצלעות $10$ ו־$13$ ס״מ.",
      [V(u"הצלעות", u"10 ו־13", CM)]),
    I(u"ב", u"לכל הצעה בטבלה קבעו אם ייתכן דלתון כזה. נמקו.",
      u"חצי המשני הוא ניצב במשולש שיתרו 10, ולכן חייב להיות קצר מ־10 ס״מ. הצעה 1: חצי 6, אפשרי. הצעה 2: חצי 10, לא אפשרי. הצעה 3: חצי 12, לא אפשרי.",
      [V(u"הצעות אפשריות", u"רק הצעה 1")], on=(u"א",)),
    I(u"ג", u"אורך האלכסון המשני הוא מספר שלם של סנטימטרים. מהו האורך הגדול ביותר האפשרי שלו? נמקו.",
      u"חצי המשני חייב להיות קצר מן הצלע הקצרה, 10 ס״מ, ולכן המשני קצר מ־20 ס״מ. האורך השלם הגדול ביותר הוא $19$ ס״מ, וחציו קצר גם מן הצלע הארוכה.",
      [V(u"האורך הגדול ביותר", u"19", CM)], on=(u"ב",)),
], table={"head": [u"הצעה", u"אורך האלכסון המשני בס״מ"],
          "rows": [["1", "12"], ["2", "20"], ["3", "24"]]})

# Q20 -- integrated chain: right head angle
P = kite_pts(5, 12, 5, rot=0, center=None)
l.q(20, u"בדלתון $ABCD$ נתון $AB=AD$ ו־$CB=CD$, והאלכסון הראשי $AC$ מצויר. נתון $∠BAD=90°$, $BD=10$ ס״מ ו־$CB=13$ ס״מ.", [
    I(u"א", u"העבירו את האלכסון $BD$ וסמנו ב־$O$ את מפגש האלכסונים. הסבירו מדוע המשולש $△AOB$ ישר זווית ושווה שוקיים.",
      u"$AC⊥BD$, ולכן $∠AOB=90°$. $AC$ חוצה את זווית הראש הישרה, ולכן $∠OAB$ היא מחצית $90°$. סכום הזוויות ב־$△AOB$ נותן גם ל־$∠ABO$ את אותו גודל, ולכן $AO=BO$.",
      [V(u"סוג המשולש", u"ישר זווית ושווה שוקיים")], make=[seg("BD"), pnt("O")], space=30),
    I(u"ב", u"מצאו את $AO$.",
      u"$AC$ חוצה את $BD$, ולכן $BO=5$ ס״מ, ומסעיף א $AO=BO=5$ ס״מ.",
      [Ln("AO", 5)], on=(u"א",), space=26),
    I(u"ג", u"חשבו את $AC$ ואת שטח הדלתון.",
      u"ב־$△COB$: $CO^2=13·13−5·5=144$, ולכן $CO=12$ ו־$AC$ הוא $17$ ס״מ. השטח $\\f{17·10}{2}$, כלומר $85$ סמ״ר.",
      [Ln("AC", 17), Area("ABCD", 85)], on=(u"ב",), space=30),
], fig=fig(P, "quad.kite+main-diagonal", segments=["AC"], right=["BAD"]),
    given=[eq("AB", "AD"), eq("CB", "CD"), an("BAD", 90),
           dict(type="perpendicular", at="A", of=["AB", "AD"]), ln("BD", 10),
           ln("CB", 13)])

Lb = l.level_dict(
    level=u"רמה ב׳", title=u"דלתון", grade=u"כיתה ט׳",
    subtitle=u"הגדרה, האלכסון הראשי, משפט הפוך, חישובים ובנייה",
    rule=u"דלתון הוא מרובע קמור שיש בו שני זוגות נפרדים של צלעות סמוכות שוות. לפי הגדרה זו גם מעוין הוא דלתון. קודקודי הראש הם הקודקודים שבין הצלעות השוות, והאלכסון המחבר אותם הוא האלכסון הראשי. עבדו ללא מחשבון, נמקו וציינו יחידות.",
    ansnote=u"מפתח פרטי — תשובות ונימוקים",
    figure_topic=True, words_share=dict(WORDS),
    curriculum=dict(topic="kite", track=u"ט_רגילה", grade="9"))

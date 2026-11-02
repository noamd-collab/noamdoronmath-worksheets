/** Verified page catalog. Do not replace this object with an empty list. */
export const catalog = {
  "contractVersion": 1,
  "sourceOfTruth": {
    "path": "index.html",
    "authoritative": true,
    "note": "index.html DATA / SEARCH_TERMS / BASE / VIEWER remain the live source of truth. This JSON is a generated contract for a future Headless frontend and must be regenerated after catalog edits."
  },
  "config": {
    "pdfBase": "https://www.noamdoronmath.co.il/_files/ugd/d8e7ad_",
    "viewer": {
      "enabled": true,
      "path": "worksheet-viewer-noam.html"
    },
    "levels": [
      {
        "key": "a",
        "label": "רמה א׳",
        "cssClass": "lvl--a"
      },
      {
        "key": "b",
        "label": "רמה ב׳",
        "cssClass": "lvl--b"
      },
      {
        "key": "c",
        "label": "רמת מצוינות",
        "cssClass": "lvl--c"
      },
      {
        "key": "c2",
        "label": "מצוינות 2",
        "cssClass": "lvl--c"
      }
    ],
    "defaults": {
      "oneLabel": "דף יחיד — כל הרמות"
    },
    "elementaryGrades": [
      1,
      2,
      3,
      4,
      5,
      6
    ],
    "middleGrades": [
      7,
      8,
      9
    ],
    "gradeNames": {
      "1": "כיתה א׳",
      "2": "כיתה ב׳",
      "3": "כיתה ג׳",
      "4": "כיתה ד׳",
      "5": "כיתה ה׳",
      "6": "כיתה ו׳",
      "7": "כיתה ז׳",
      "8": "כיתה ח׳",
      "9": "כיתה ט׳"
    },
    "gradeEmojis": {
      "1": "🎈",
      "2": "🧮",
      "3": "✏️",
      "4": "📐",
      "5": "📊",
      "6": "🚀",
      "7": "🧭",
      "8": "🧪",
      "9": "🎯"
    },
    "trackGroups": [
      "r9oct",
      "r9sep"
    ],
    "noamPrefixFallback": {
      "7": {
        "16": "G7-T16"
      },
      "8": {
        "1": "G8-T01",
        "26": "G8-T35",
        "34": "G8-T26",
        "35": "G8-T27",
        "56": "G8-T56",
        "57": "G8-T57",
        "58": "G8-T58",
        "59": "G8-T59",
        "60": "G8-T60"
      },
      "9": {
        "22": "G9-T16"
      }
    }
  },
  "icons": {
    "analytic": "<path d=\"M5.5 3v16h16\"/><path d=\"M9 15l8-7\"/><circle cx=\"9\" cy=\"15\" r=\"1.6\"/><circle cx=\"17\" cy=\"8\" r=\"1.6\"/>",
    "angle": "<path d=\"M4.5 19h15M4.5 19L16 6.5\"/><path d=\"M10.5 19a6.5 6.5 0 0 0-2.2-4.8\"/>",
    "arrowbox": "<rect x=\"11\" y=\"6\" width=\"9.5\" height=\"12\" rx=\"2\"/><path d=\"M2.5 12H8M5.5 9l2.8 3-2.8 3\"/>",
    "arrowr": "<path d=\"M3.5 12h13M12 7l5 5-5 5M3.5 7h5M3.5 17h5\"/>",
    "avg": "<path d=\"M6 20v-6.5M12 20V8M18 20v-9.5\"/><path d=\"M3 12.5h18\" stroke-dasharray=\"3 2.6\"/>",
    "axes": "<path d=\"M5.5 3v16h16\"/><path d=\"M3 5.5L5.5 3 8 5.5M19 16.5L21.5 19 19 21.5\"/>",
    "bars": "<path d=\"M6 20v-7.5M12 20V6.5M18 20v-10M3 20h18\"/>",
    "book": "<path d=\"M12 5.5C10 4 7 3.5 4 3.5v15c3 0 6 .5 8 2 2-1.5 5-2 8-2v-15c-3 0-6 .5-8 2z\"/><path d=\"M12 5.5v15\"/>",
    "box_eq": "<rect x=\"3.5\" y=\"7\" width=\"8\" height=\"10\" rx=\"1.5\"/><path d=\"M15 10h5.5M15 14h5.5\"/>",
    "braces": "<path d=\"M9 4C7 4 7.5 7 7.5 9s.3 3-2.5 3c2.8 0 2.5 1 2.5 3S7 20 9 20M15 4c2 0 1.5 3 1.5 5s-.3 3 2.5 3c-2.8 0-2.5 1-2.5 3s.5 5-1.5 5\"/>",
    "branch": "<path d=\"M3.5 12H10M10 12l6-5M10 12l6 5\"/><circle cx=\"18.5\" cy=\"6.5\" r=\"1.6\"/><circle cx=\"18.5\" cy=\"17.5\" r=\"1.6\"/>",
    "bridge": "<path d=\"M3 17.5h18M6.5 17.5v-4a5.5 5.5 0 0 1 11 0v4\"/><path d=\"M9.5 17.5v-2.6M14.5 17.5v-2.6M12 17.5v-3.5\"/>",
    "bulb": "<path d=\"M12 3a6 6 0 0 0-3.8 10.6c.9.8 1.3 1.7 1.3 2.9h5c0-1.2.4-2.1 1.3-2.9A6 6 0 0 0 12 3z\"/><path d=\"M9.5 19.5h5M10.5 22h3\"/>",
    "checklist": "<path d=\"M4 6.5h3.5M4 12h3.5M4 17.5h3.5M11 5.5l1.8 1.8 3.7-3.8M11 12h9M11 17.5h9\"/>",
    "circle": "<circle cx=\"12\" cy=\"12\" r=\"8.5\"/><path d=\"M12 12h8.5\"/>",
    "clipboard": "<rect x=\"5\" y=\"4.5\" width=\"14\" height=\"16.5\" rx=\"2\"/><path d=\"M9.5 4.5h5V7h-5z\"/><path d=\"M8.5 12h7M8.5 16h4.5\"/>",
    "clipcheck": "<rect x=\"5\" y=\"4.5\" width=\"14\" height=\"16.5\" rx=\"2\"/><path d=\"M9.5 4.5h5V7h-5z\"/><path d=\"M8.5 13.5l2.8 2.8 4.7-5.6\"/>",
    "clock": "<circle cx=\"12\" cy=\"12\" r=\"8.5\"/><path d=\"M12 7v5l3.5 2\"/>",
    "cross2": "<path d=\"M4 17.5L20 6M4 7l16 10.5\"/><circle cx=\"12\" cy=\"12\" r=\"1.9\"/>",
    "cube": "<path d=\"M4 8.5l8-4.5 8 4.5v7l-8 4.5-8-4.5z\"/><path d=\"M4 8.5l8 4.5 8-4.5M12 13v7\"/>",
    "cycle": "<path d=\"M7 8a6.5 6.5 0 0 1 10.5 1.5M17 16a6.5 6.5 0 0 1-10.5-1.5\"/><path d=\"M17.5 5.5v4h-4M6.5 18.5v-4h4\"/>",
    "cyl": "<ellipse cx=\"12\" cy=\"6\" rx=\"7\" ry=\"2.8\"/><path d=\"M5 6v11.5c0 1.6 3.1 2.9 7 2.9s7-1.3 7-2.9V6\"/>",
    "dashrect": "<rect x=\"4\" y=\"6\" width=\"16\" height=\"12\" rx=\"1\" stroke-dasharray=\"3.2 3\"/>",
    "dice": "<rect x=\"4\" y=\"4\" width=\"16\" height=\"16\" rx=\"3.5\"/><circle cx=\"9\" cy=\"9\" r=\"1.3\"/><circle cx=\"15\" cy=\"9\" r=\"1.3\"/><circle cx=\"9\" cy=\"15\" r=\"1.3\"/><circle cx=\"15\" cy=\"15\" r=\"1.3\"/>",
    "divide": "<circle cx=\"12\" cy=\"5.5\" r=\"1.4\"/><line x1=\"4.5\" y1=\"12\" x2=\"19.5\" y2=\"12\"/><circle cx=\"12\" cy=\"18.5\" r=\"1.4\"/>",
    "dots2": "<path d=\"M5.5 3v16h16\"/><path d=\"M8 16L19 6\"/><circle cx=\"8\" cy=\"16\" r=\"1.8\"/><circle cx=\"15.2\" cy=\"9.4\" r=\"1.8\"/>",
    "factor": "<path d=\"M8 5C5.5 8 5.5 16 8 19M16 5c2.5 3 2.5 11 0 14\"/><circle cx=\"12\" cy=\"12\" r=\"1.7\"/>",
    "flask": "<path d=\"M10 3.5h4M11 3.5V9l-4.8 8.6A2 2 0 0 0 8 20.5h8a2 2 0 0 0 1.8-2.9L13 9V3.5\"/><path d=\"M8.2 15.5h7.6\"/>",
    "frac": "<path d=\"M6 12h12\"/><circle cx=\"12\" cy=\"6.8\" r=\"2.1\"/><circle cx=\"12\" cy=\"17.2\" r=\"2.1\"/>",
    "gridlines": "<path d=\"M5.5 3v16h16\"/><path d=\"M10 5v12M5.5 9.5h14\"/>",
    "gridrect": "<rect x=\"4\" y=\"6\" width=\"16\" height=\"12\"/><path d=\"M4 12h16M12 6v12\"/>",
    "kite": "<path d=\"M12 3l6 7.5L12 21l-6-10.5z\"/><path d=\"M12 3v18M6 10.5h12\"/>",
    "linear": "<path d=\"M5.5 3v16h16\"/><path d=\"M8 17L20 6.5\"/>",
    "lshape": "<path d=\"M4 4h9.5v6.5H20V20H4z\"/>",
    "lt": "<path d=\"M17.5 5.5L7 12l10.5 6.5\"/>",
    "machine": "<rect x=\"8\" y=\"7\" width=\"8\" height=\"10\" rx=\"2\"/><path d=\"M2.5 12H8M16 12h5.5\"/>",
    "magnify": "<circle cx=\"10.5\" cy=\"10.5\" r=\"6\"/><path d=\"M15 15l6 6\"/>",
    "map": "<path d=\"M3.5 5.5l5.5-2 6 2 5.5-2v15l-5.5 2-6-2-5.5 2zM9 3.5v15M15 5.5v15\"/>",
    "median": "<circle cx=\"4.5\" cy=\"12\" r=\"1.4\"/><circle cx=\"9\" cy=\"12\" r=\"1.4\"/><circle cx=\"13.7\" cy=\"12\" r=\"2.6\"/><circle cx=\"19.5\" cy=\"12\" r=\"1.4\"/>",
    "medtri": "<path d=\"M12 4l9 15H3z\"/><path d=\"M12 4v15\"/>",
    "mirror": "<path d=\"M12 3v18\" stroke-dasharray=\"3 3\"/><path d=\"M8 7L4 12l4 5M16 7l4 5-4 5\"/>",
    "numline": "<line x1=\"2\" y1=\"12\" x2=\"22\" y2=\"12\"/><line x1=\"7\" y1=\"9\" x2=\"7\" y2=\"15\"/><line x1=\"12\" y1=\"9\" x2=\"12\" y2=\"15\"/><line x1=\"17\" y1=\"9\" x2=\"17\" y2=\"15\"/>",
    "parabola": "<path d=\"M4.5 4.5v15\"/><path d=\"M6 6c2.5 15 11.5 15 14 0\"/>",
    "parens": "<path d=\"M8.5 4C5.5 8 5.5 16 8.5 20M15.5 4c3 4 3 12 0 16\"/>",
    "percent": "<path d=\"M5.5 18.5l13-13\"/><circle cx=\"7.5\" cy=\"7.5\" r=\"2.6\"/><circle cx=\"16.5\" cy=\"16.5\" r=\"2.6\"/>",
    "pgram": "<path d=\"M7.5 6.5H21l-4.5 11H3z\"/>",
    "pie": "<circle cx=\"12\" cy=\"12\" r=\"8.5\"/><path d=\"M12 12V3.5M12 12l6.2 5.5\"/>",
    "plusminus": "<path d=\"M8 4.5v7M4.5 8h7M13 16.5h7\"/>",
    "point": "<path d=\"M5.5 3v16h16\"/><circle cx=\"14\" cy=\"9.5\" r=\"2.2\"/>",
    "power": "<rect x=\"4\" y=\"9\" width=\"10\" height=\"10\" rx=\"1.5\"/><rect x=\"16\" y=\"4\" width=\"5\" height=\"5\" rx=\"1\"/>",
    "prism": "<path d=\"M8 15l4-8 4 8z\"/><path d=\"M8 15v4.5h8V15\"/>",
    "protractor": "<path d=\"M4 16a8 8 0 0 1 16 0z\"/><path d=\"M12 16v-5.5M7 16l1-2.5M17 16l-1-2.5\"/>",
    "pythag": "<path d=\"M5.5 19V6l13.5 13z\"/><path d=\"M5.5 14.5H10V19\"/>",
    "quadrants": "<path d=\"M12 2.5v19M2.5 12h19\"/><circle cx=\"17\" cy=\"7\" r=\"1.7\"/>",
    "range": "<path d=\"M3.5 12h17M3.5 12l3.2-3.2M3.5 12l3.2 3.2M20.5 12l-3.2-3.2M20.5 12l-3.2 3.2\"/>",
    "ratio": "<rect x=\"3.5\" y=\"6.5\" width=\"5.5\" height=\"11\" rx=\"1\"/><rect x=\"15\" y=\"6.5\" width=\"5.5\" height=\"11\" rx=\"1\"/><circle cx=\"12\" cy=\"9.5\" r=\"1.2\"/><circle cx=\"12\" cy=\"14.5\" r=\"1.2\"/>",
    "rect2": "<rect x=\"3.5\" y=\"6.5\" width=\"17\" height=\"11\"/><path d=\"M3.5 6.5l17 11M20.5 6.5l-17 11\"/>",
    "rhomb": "<path d=\"M12 3l8 9-8 9-8-9z\"/><path d=\"M12 3v18M4 12h16\"/>",
    "root": "<path d=\"M3 13.5l3.5 6L11 4.5h10\"/>",
    "ruler": "<g transform=\"rotate(-24 12 12)\"><rect x=\"2.5\" y=\"9\" width=\"19\" height=\"6\" rx=\"1.2\"/><path d=\"M7 9v2.8M11.5 9v2.8M16 9v2.8\"/></g>",
    "scale": "<path d=\"M12 4v13M6.5 7h11M6.5 7l-3.5 5.5h7zM17.5 7L14 12.5h7zM8.5 20h7\"/>",
    "slope": "<path d=\"M4 19L20 5.5\"/><path d=\"M4 19h7M11 19v-6\" stroke-dasharray=\"3 2.6\"/>",
    "speech": "<path d=\"M4 5h16v11h-9.5L6 20v-4H4z\"/>",
    "sq2": "<rect x=\"4\" y=\"10.5\" width=\"8\" height=\"8\"/><rect x=\"13.5\" y=\"4.5\" width=\"6\" height=\"6\"/>",
    "square2": "<rect x=\"4.5\" y=\"4.5\" width=\"15\" height=\"15\"/><path d=\"M4.5 4.5l15 15M19.5 4.5l-15 15\"/>",
    "star": "<path d=\"M12 3l2.6 5.5 6.1.8-4.5 4.2 1.2 6L12 16.6l-5.4 2.9 1.2-6L3.3 9.3l6.1-.8z\"/>",
    "steps": "<path d=\"M3 19.5h5v-4.5h5v-4.5h5V6h3.5\"/>",
    "syseq": "<path d=\"M4 7.5h7M4 11h7M13 13h7M13 16.5h7\"/>",
    "table": "<rect x=\"3.5\" y=\"5\" width=\"17\" height=\"14\" rx=\"1\"/><path d=\"M3.5 10h17M9.5 5v14M15.5 5v14\"/>",
    "tag": "<path d=\"M3.5 12l8.5-8.5H20.5V11.5L12 20z\"/><circle cx=\"16.5\" cy=\"7.5\" r=\"1.6\"/>",
    "tally": "<path d=\"M5.5 5v14M9.5 5v14M13.5 5v14M17.5 5v14M3.5 16.5L19.5 7\"/>",
    "times": "<path d=\"M6 6l12 12M18 6L6 18\"/>",
    "trapez": "<path d=\"M8 6.5h8l4.5 11h-17z\"/>",
    "triangle": "<path d=\"M12 4l9.5 15.5H2.5z\"/>",
    "tridash": "<path d=\"M12 4l9 15H3z\"/><path d=\"M12 4v15\" stroke-dasharray=\"3 3\"/>",
    "tritick": "<path d=\"M12 4l8.5 15.5H3.5z\"/><path d=\"M6.8 11.5l2 1.4M17.2 11.5l-2 1.4\"/>",
    "twotri": "<path d=\"M8 5.5l5 8.5H3zM16 10l5.5 9.5H10.5z\"/>",
    "twotri2": "<path d=\"M9 12.5L12 7l3 5.5zM4.5 20L12 6.5 19.5 20z\"/>",
    "updown": "<path d=\"M8 4.5v15M8 4.5L5 7.5M8 4.5l3 3M16 19.5v-15M16 19.5l-3-3M16 19.5l3-3\"/>",
    "wave": "<path d=\"M3 15.5c2.5-8 5-8 7.5 0s5 6 7.5-2.5\"/>"
  },
  "searchTerms": {
    "1": {
      "2": "ספרות מספר עשרת יחידות",
      "3": "גדול קטן שווה השוואת מספרים סימן",
      "10": "סדרה חוקיות דפוס המשך תבנית",
      "13": "שוויון נעלם משוואה איזון",
      "15": "סנטימטר סרגל מדידה ארוך קצר",
      "17": "משולש מרובע מחומש משושה צלע קודקוד צורות",
      "18": "מרובע צלעות שוות מלבנים ריבועים",
      "20": "שעון מחוגים שעות זמן",
      "21": "דיאגרמת עמודות גרף טבלה איסוף מידע"
    },
    "2": {
      "3": "מאות עשרות יחידות ערך מקום",
      "5": "חיבור מאונך בטור אנכי",
      "6": "חיבור מאונך בטור אנכי המרה שארית",
      "12": "גרף עמודות דיאגרמה טבלה נתונים",
      "16": "לוח הכפל פעמים",
      "23": "סנטימטר מטר סרגל מדידה",
      "25": "שעון מחוגים דקות שעות",
      "26": "שבר חצאים רבעים חלקים שווים",
      "28": "קובייה תיבה גליל כדור משולש מרובע",
      "29": "שיקוף מראה סימטריה קו סימטריה"
    },
    "3": {
      "2": "אלף אלפים ערך מקום ספרות",
      "6": "חיבור מאונך בטור אנכי המרה",
      "7": "חיסור מאונך בטור אנכי פריטה",
      "11": "שבר מונה מכנה חלק שלם",
      "12": "זווית ישרה חדה קהה מד זווית",
      "14": "משולש מרובע מחומש משושה צלע קודקוד",
      "15": "היקף סכום צלעות",
      "16": "משולש שווה צלעות שווה שוקיים ישר זווית",
      "17": "ריבוע מלבן מעוין מקבילית טרפז מרובע צלעות מקבילות זוויות ישרות אלכסון",
      "19": "שעון דקות שניות קילוגרם גרם שקילה",
      "22": "סנטימטר מטר מילימטר קילומטר המרה",
      "25": "שקל אגורות מטבעות שטרות קנייה עודף"
    },
    "4": {
      "1": "רבבה מיליון ערך מקום מספרים גדולים",
      "3": "חיבור מאונך בטור אנכי המרה",
      "4": "חיסור מאונך בטור אנכי פריטה",
      "7": "כפל מאונך בטור דו ספרתי",
      "9": "חילוק ארוך שארית",
      "11": "שבר מונה מכנה שקילות",
      "13": "שברים שקולים הרחבה צמצום",
      "14": "מחלקים כפולות סימני התחלקות",
      "15": "ראשוני פריק פירוק לגורמים",
      "21": "מילימטר סנטימטר מטר קילומטר המרות",
      "22": "שטח היקף סמר מטר רבוע",
      "24": "קילוגרם גרם טון שעות דקות",
      "26": "שיקוף סיבוב קו סימטריה",
      "27": "זווית ישרה חדה קהה שטוחה מקבילים מאונכים",
      "28": "שווה צלעות שווה שוקיים ישר זווית חד זווית קהה זווית",
      "29": "דלתון טרפז מעוין מקבילית מלבן ריבוע הכלה מיון אלכסונים"
    },
    "5": {
      "7": "מונה מכנה חלק משלם",
      "9": "הרחבה צמצום שברים שקולים",
      "10": "מכנה משותף קטן ביותר",
      "13": "שבר מדומה מספר מעורב שלמים",
      "18": "דלתון טרפז מעוין מקבילית מלבן ריבוע משפחה הכלה",
      "19": "דלתון אלכסונים מאונכים חוצים תכונות מרובעים",
      "21": "קילוגרם גרם טון המרות",
      "25": "שטח היקף מטר רבוע",
      "27": "מקבילית בסיס גובה שטח",
      "28": "שבר עשרוני נקודה עשרונית",
      "29": "עשרוני חיבור חיסור",
      "30": "עשרוני כפל חילוק"
    },
    "6": {
      "2": "מכנה משותף שברים חיבור חיסור",
      "9": "שבר עשרוני נקודה עשרונית",
      "11": "פאה מקצוע קודקוד מנסרה פירמידה גליל",
      "12": "פריסה תלת ממד קובייה",
      "13": "שטח פנים פאות",
      "14": "נפח סמק מטר מעוקב",
      "15": "מיליליטר ליטר סמק מק קיבול נוזלים",
      "16": "דלתון טרפז מעוין מקבילית מלבן ריבוע הכלה מיון",
      "18": "אחוז שבר עשרוני המרה",
      "19": "אחוזים חישוב חלק מכמות",
      "20": "אחוז השלם הנחה התייקרות",
      "21": "יחס פרופורציה חלוקה",
      "22": "קנה מידה מפה שרטוט הקטנה הגדלה"
    },
    "7": {
      "1": "ערך מוחלט נגדי ציר",
      "6": "בסיס מעריך חזקה",
      "7": "רדיקל שורשים",
      "11": "מד זווית חדה קהה ישרה שטוחה",
      "13": "צמודות קודקודיות משלימות",
      "15": "שווה שוקיים שווה צלעות ישר זווית",
      "20": "קובייה נפח שטח פנים פאות",
      "27": "סיכוי מזל הגרלה קובייה מטבע",
      "41": "משפט פיתגורס ניצב יתר",
      "43": "היקף מצולעים",
      "44": "טרפז מקבילית בסיס גובה שטח",
      "46": "מנסרה נפח בסיס משולש",
      "47": "מנסרה שטח פנים מעטפת פריסה",
      "48": "סדרה סדרות דפוס תבנית איבר כללי המשך הסדרה כלל חוקיות"
    },
    "8": {
      "4": "יחס פרופורציה חלוקה",
      "5": "מפה שרטוט הקטנה הגדלה",
      "6": "אחוז שבר עשרוני המרה",
      "7": "מעמ ריבית הנחה התייקרות אחוזים",
      "8": "עלייה ירידה אחוז שינוי",
      "11": "משפט פיתגורס ניצב יתר",
      "13": "גליל מעטפת בסיס עיגול",
      "14": "גליל רדיוס נפח",
      "15": "חרוט קודקוד בסיס מעגל נפח",
      "18": "עיגול מגזרים אחוזים עוגה",
      "23": "ממוצע משוקלל",
      "28": "פיזור ערכים קיצוניים",
      "33": "מהירות דרך זמן מפגש",
      "40": "שווה שוקיים זוויות בסיס",
      "43": "יחס דמיון קנה מידה",
      "47": "נקודת חיתוך שתי משוואות גרפים",
      "54": "אלכסון תיבה מרחב",
      "65": "הוכחה חפיפה משפטי חפיפה טענה נימוק נתון משותף דף מסכם"
    },
    "9": {
      "2": "פתיחת סוגריים כפל מקוצר",
      "3": "טרינום הפרש ריבועים גורם משותף",
      "4": "דלתון kite",
      "5": "רדיקל תחום הגדרה",
      "6": "פרבולה קודקוד ציר סימטריה נקודות אפס",
      "8": "שיפוע מרחק אמצע קטע משוואת ישר",
      "12": "פונקציות גרפים קריאת גרף",
      "13": "הכנה לתיכון יחידות לימוד 4 5 חזרה",
      "20": "מקביליות צלעות נגדיות אלכסונים",
      "22": "מעוינים אלכסונים מאונכים",
      "23": "ריבועים מעוין מלבן מקביליות אלכסונים",
      "39": "טרפז בסיסים שוקיים שווה שוקיים ישר זווית שטח היקף",
      "44": "דו איבר דו־איבר דו-איבר ריבוע דו איבר ריבוע סכום ריבוע הפרש נוסחאות כפל מקוצר נוסחות פתיחת סוגריים פישוט ביטויים",
      "45": "הפרש ריבועים נוסחאות כפל מקוצר נוסחות מכפלת סכום והפרש פירוק לגורמים ריבועים אלגברה",
      "46": "דלתון צלעות סמוכות אלכסון ראשי קודקוד ראש שטח היקף"
    }
  },
  "grades": [
    {
      "grade": 1,
      "label": "כיתה א׳",
      "emoji": "🎈",
      "groups": [
        {
          "key": "num",
          "label": "מספרים ומנייה",
          "reducedProgram": false
        },
        {
          "key": "addsub",
          "label": "חיבור וחיסור",
          "reducedProgram": false
        },
        {
          "key": "think",
          "label": "חשיבה, דפוסים ושוויון",
          "reducedProgram": false
        },
        {
          "key": "word",
          "label": "בעיות מילוליות",
          "reducedProgram": false
        },
        {
          "key": "geo",
          "label": "גיאומטריה ומדידות",
          "reducedProgram": false
        },
        {
          "key": "data",
          "label": "נתונים",
          "reducedProgram": false
        }
      ],
      "topics": [
        {
          "id": 1,
          "title": "מונים בלי לפספס",
          "group": "num",
          "icon": "tally",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "3b7080759e5240fe8f7faa8e0e261084",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "93024cad97864567b17f16023aec04ed",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "aa53193933054f77939bc8349c748461",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 2,
          "title": "קוראים כותבים ומייצגים עד 100",
          "group": "num",
          "icon": "star",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "565d8a7618b148619387c3132bb74c4d",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "e955cca812d1457eb75d2c88b3a852e0",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "cb0711433bac40efa0c2fdf8a1d705a6",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 3,
          "title": "סדר שכנים והשוואה",
          "group": "num",
          "icon": "lt",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "087677099c724f8abcc48834af6a5ee2",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "e5fb1788eebf4454af724db1134864ee",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "1284b66742884f629e4ab6a692fad4f7",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 4,
          "title": "מרכיבים ומפרקים עד 10",
          "group": "addsub",
          "icon": "branch",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "1eb6198dbf4f45df9cb7a0727a87aa82",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "7def3a0c711240ff9040ab12d0a175a5",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "b82e06e37d6347ba9894733742f7ed3a",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 5,
          "title": "חיבור בתחום 10",
          "group": "addsub",
          "icon": "plusminus",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "8482661bf8064a19825e8433087b86df",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "5e45520af87542ed8fe6bd954ec62e1d",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "86fee50806ab4f2bb085a2874548e622",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 6,
          "title": "חיסור בתחום 10",
          "group": "addsub",
          "icon": "plusminus",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "1696192f5f054d5e853fcaee49e1500b",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "6fe74bdf0cc74ef1839970e06dbe683f",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "52bf36b6b0c34c0b94f390c623010a55",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 7,
          "title": "בונים 20 דרך 10",
          "group": "addsub",
          "icon": "star",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "d8a231ad5afa45998b0a22498216a4c8",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "0dbf6ebd9d444700a077f9e2d5bd599e",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "9aac4b55e7524b429cb7d222dda40612",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 8,
          "title": "חיבור בתחום 20",
          "group": "addsub",
          "icon": "plusminus",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "b3d2659bb61b410ea9a5e23c8ddfa705",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "25b115607d574d89b99d5e41a67c5d18",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "0741b30f161245b79fcaf13dd8c87892",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 9,
          "title": "חיסור בתחום 20",
          "group": "addsub",
          "icon": "plusminus",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "f488deb2d20440fe94ede20dec685858",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "0d6aa328c2e74cc798ae04eb9c6301cf",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "c656760c7d4449b6acb2fb6463bb719d",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 10,
          "title": "שוויון נעלם והשוואת תרגילים",
          "group": "think",
          "icon": "scale",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "e34e62a0e28d41749baa3c91c228bc24",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "7365ed0dcf294b1db773cc5e49b4fe04",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "b249e11faa6a4d3bb433ee85e0c071c6",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 11,
          "title": "דפוסים וסדרות",
          "group": "think",
          "icon": "steps",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "fa4a852d28a2413194e3df3b911ae62e",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "ac4e8a55534a44a9a7bb55002c61a59f",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "cb6081f38fc843d9a0808ef67dda7b5f",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 12,
          "title": "חוקרים את לוח המאה",
          "group": "num",
          "icon": "table",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "a7a85defdc5446cf9680b0876360dd78",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "77167bf796284fc2a9c7c5b2b32c9b8f",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "aec3c001aced4b7ca67f4e5d07bed89d",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 13,
          "title": "שרשראות ופירמידות מספרים",
          "group": "think",
          "icon": "steps",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "d9fd0dfdc28b4dbba0c299bb8aaa835a",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "4f950534797e45fc893d3122ef37df09",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "a44d8a914a7944269031d386616d059e",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 14,
          "title": "בעיות מילוליות בציור ובמספר",
          "group": "word",
          "icon": "speech",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "993862a7e55342d38e89fd9cd322dfcf",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "82a5fb61ee63421c95ecdce03e96eade",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "d5150d40761143e29f4ca6498dd15c27",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 15,
          "title": "מודדים ומשווים אורך",
          "group": "geo",
          "icon": "ruler",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "27609e0a818e4734be2d91cf2256cdb8",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "d9d3938fc7d94c4e844dee3c1631f42d",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "56bd82d2c55e45ae8361dda997a8e5bc",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 16,
          "title": "קבוצות שוות וחיבור חוזר",
          "group": "addsub",
          "icon": "plusminus",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "f178d05de2aa4bb48cdb8366de692b22",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "6b04a93bef8048b9a3ede394c01b8c47",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "8450b90c1f314bf48b4262f4a5a4e948",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 17,
          "title": "מצולעים",
          "group": "geo",
          "icon": "pgram",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "e164f4a076a648ada3ee4da1440c5c90",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "b534b62f2e0e4a1197ac7fd27d2a7014",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "90a621ac2acd4e13972ff8d64a5cad58",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 18,
          "title": "ריבוע ומלבן",
          "group": "geo",
          "icon": "rhomb",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "8356de8c0bfe4b92937091bab7347a03",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "887a0729bda64d8d81eb1c033e4d167e",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "f54c90c36f054c3681381f178069f265",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 19,
          "title": "מרכיבים ומפרקים",
          "group": "addsub",
          "icon": "branch",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "7e0abedb940449d684f2af1ec1ca95a1",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "4fae6c5d4ad54d97a52e3b25a12101f0",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "6ff20850f90b4006855b56f7e54c4c11",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 20,
          "title": "שעה שלמה",
          "group": "geo",
          "icon": "clock",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "8b8a3d3c0dd04a098a31beca631fbbc8",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "08619875e75949978a7a0117581e1768",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "ff7e1b534d2741bcb33afc310ba1b7ab",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 21,
          "title": "נתונים",
          "group": "data",
          "icon": "bars",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "8207640e48594b30866254ec1b4e53ed",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "b610f28362444d6486e866e3e18ff353",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "eb9ea1806b9e494ba835dc2f182d54bb",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 22,
          "title": "בעיות מילוליות פשוטות",
          "group": "word",
          "icon": "speech",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "3082fcf59c844db5aa87f427c956c921",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "9e8d4d3e97f2412988e5f8fed4039d04",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "4901e467c30a42f19490fad085c048b3",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 23,
          "title": "הרכבה ופירוק",
          "group": "addsub",
          "icon": "branch",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "aacbfd9b229a481a856213a019590f82",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "201acd73177e4dc69dd7ebdc10303a1e",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "daa26ec41a8e4045848e7210b4490984",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        }
      ]
    },
    {
      "grade": 2,
      "label": "כיתה ב׳",
      "emoji": "🧮",
      "groups": [
        {
          "key": "num",
          "label": "מספרים עד 1000",
          "reducedProgram": false
        },
        {
          "key": "addsub",
          "label": "חיבור וחיסור",
          "reducedProgram": false
        },
        {
          "key": "muldiv",
          "label": "כפל וחילוק",
          "reducedProgram": false
        },
        {
          "key": "think",
          "label": "דפוסים, חשיבה וסיכום",
          "reducedProgram": false
        },
        {
          "key": "word",
          "label": "בעיות מילוליות וכסף",
          "reducedProgram": false
        },
        {
          "key": "frac",
          "label": "שברים ראשונים",
          "reducedProgram": false
        },
        {
          "key": "meas",
          "label": "מדידות וזמן",
          "reducedProgram": false
        },
        {
          "key": "geo",
          "label": "גיאומטריה",
          "reducedProgram": false
        },
        {
          "key": "data",
          "label": "נתונים",
          "reducedProgram": false
        }
      ],
      "topics": [
        {
          "id": 1,
          "title": "חוזרים להרכבות 10 ו־20",
          "group": "num",
          "icon": "branch",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "93ebe0eb0303457bb305b41577498037",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "f7e8186f8f934bf6afd41a28b8e762de",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "56dd1fc5347943b48fea991334b4d940",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 2,
          "title": "עשרות ויחידות בתחום 100",
          "group": "num",
          "icon": "table",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "5d590fa4720448a7b3020a2256cac55c",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "f260e9f8518c40969d687883f88e31e7",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "e7a4d6dd428a4d618c9c132abd0b6689",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 3,
          "title": "סדר השוואה וישר מספרים",
          "group": "num",
          "icon": "numline",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "3454a93cf2d14ccc99cf653701b897bd",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "311e3ef7d6d74e22a102045f10f4bb61",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "16a9ca02cc94415fbdae558f32332987",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 4,
          "title": "מוסיפים עשרות ומפרקים מספרים",
          "group": "addsub",
          "icon": "branch",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "b9e00c1b0fca4672aeb0447a937888c8",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "6c9e22dc5d4648a29e0bdb675c73bd1f",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "64bb3b9026a54e5cbf378e653861c44b",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 5,
          "title": "חיבור דו־ספרתי ללא המרה",
          "group": "addsub",
          "icon": "plusminus",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "1c5c6d9ccd0d434699e29fc589e19d56",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "47d4638e1a904015b1d8f724681bb799",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "c15da48ebb3f4a6ea3737c71c20810f2",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 6,
          "title": "חיבור דו־ספרתי עם המרה",
          "group": "addsub",
          "icon": "plusminus",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "89d6ffb21a134d319ead83904817acb5",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "e1fd4ea38ff24d3abba2e16411388444",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "c761f8d29d3d412b99c7e11044807c9c",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 7,
          "title": "חיסור דו־ספרתי ללא פריטה",
          "group": "addsub",
          "icon": "plusminus",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "01acfa2796fb419e98f1c557afcf5ad6",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "15bc7f5e05714c4ea42d97638371fac3",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "79e33ab35ac14f7c89703b88304565c3",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 8,
          "title": "חיסור דו־ספרתי עם פריטה",
          "group": "addsub",
          "icon": "plusminus",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "c01401da7a404a8eba3bb017352f9940",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "eeb6f6ef08274bce9df4e9863ac5a7c4",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "efc337091f534ebb81808317094acfe4",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 9,
          "title": "אסטרטגיות חישוב אומדן ופיצוי",
          "group": "addsub",
          "icon": "magnify",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "fc252874db8c4b6a9e6339b6cea3f3ea",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "2e0c66dfae8b4fffa2e7f0df40507b23",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "925868b9f4b940898274eba615f23668",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 10,
          "title": "שוויון ומספר חסר",
          "group": "addsub",
          "icon": "scale",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "932ac8f7a0b446dc8f3054082f99af68",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "5c4668e01a434b9bb6ee2c05060901d1",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "d03912693f984e9ba2bc8d7cbba998b5",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 11,
          "title": "בעיות מילוליות וכסף",
          "group": "word",
          "icon": "tag",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "185b6b6898fa493fbe033dcb450ba2a1",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "e7d34c800da64904913891d951abc08f",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "f0322f3b96534e008538a9b9c2287fa8",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 12,
          "title": "קוראים טבלה ודיאגרמת עמודות",
          "group": "data",
          "icon": "bars",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "06d904d53a9c4d3194b7cc763ccb4447",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "b8166c63691f4eacb6111a57a2edea1f",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "743ea1ca16d146f887ce0ddd3f703ef6",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 13,
          "title": "מאות עשרות ויחידות",
          "group": "num",
          "icon": "table",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "7a1677cade96484e9e99a12cd8a22d7a",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "96210fe573df48cc9403e182900b67a7",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "ea729112623947438f48fc3e3b982219",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 14,
          "title": "ממיינים ומשווים מספרים עד 1000",
          "group": "num",
          "icon": "lt",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "a5cb541e565b4dba8c36a1f8865344dc",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "14892443cd424d4d884c9e11104cce63",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "8e0207e52c854a6a95418b1353587174",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 15,
          "title": "מספרים עד 1000",
          "group": "num",
          "icon": "numline",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "451e1aaba1cd4811a3929697d2049b4a",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "d30a41993b3b43d7a382a5014f19b9b1",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "2752eeb577bf476dbf0c67b4c58928d6",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 16,
          "title": "כפל קבוצות שוות ומערכים",
          "group": "muldiv",
          "icon": "times",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "48ecf4e316e14ab185bcbf726f86a09f",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "b980f7718c5a417aa47d45fdfb5b1116",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "29f03da2ae744fb8bcc2c2f8a5f0bfc3",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 17,
          "title": "חילוק להכלה",
          "group": "muldiv",
          "icon": "divide",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "c4014a193c9a4e77ba34755ff95b71d3",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "d7ccca4dfca9496fa61581c7db5201f7",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "9b30a9dde8a54935a7f928d804158983",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 18,
          "title": "חילוק לחלקים שווים",
          "group": "muldiv",
          "icon": "divide",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "1946612fd6794dbbb514c8f97edea75b",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "85ff43db693a4fdd8d6f785619a52558",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "2d947122f72744a2b3c3eb5057bb0ba1",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 19,
          "title": "משפחת כפל וחילוק",
          "group": "muldiv",
          "icon": "times",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "f2439d1ce90d4c2a87485dfc534bb79e",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "ef4ab672a58642ecb2a323e4c08de80c",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "9b384b81ac59432382296203e0478944",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 20,
          "title": "פי בקבוצות שוות",
          "group": "muldiv",
          "icon": "star",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "f5d3a7e9b364436897f87f030dc92259",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "4db357775cc94905a844a1ea64a8b28b",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "a067bf391896471bb199868cba1a9a2f",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 21,
          "title": "זוגי אי־זוגי וסדרות א׳",
          "group": "think",
          "icon": "steps",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "2113855c96244de6bf59a91f7f931b49",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "9e43bc9407354193a8f413f0fc742d01",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "ca3da8674b8c4315af973bc4f9fe76f6",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 22,
          "title": "זוגי אי־זוגי וסדרות ב׳",
          "group": "think",
          "icon": "steps",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "dde8aeeba45c4601a2b01c386a200df2",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "ef35e8bd27eb48cea6c76d479ce01e57",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "31c30b40f55d44efb4804bd12e4b52f8",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 23,
          "title": "מדידת אורך",
          "group": "meas",
          "icon": "ruler",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "08a221fcde964d8dbb1350eeeebe1c36",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "a7e163c12aef42feb8628ce01ee1b91f",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "322f4b74298d496b827e204fd7edc69f",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 24,
          "title": "בעיות מילוליות וכסף פשוט",
          "group": "word",
          "icon": "tag",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "23aa357184e44b7d91e784ad87fba10c",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "4994bc3777ef4ddd82f21d455a0cd2f5",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "63bed16964274aba8c5111993c682513",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 25,
          "title": "שעון ומשך זמן",
          "group": "meas",
          "icon": "clock",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "ad0473bbbd944ae59bc60449928df6d1",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "f03eaeae9bf943cd968c931139c2fcff",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "09ed723fa5b34bfca4d4124d31e23cf7",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 26,
          "title": "חצי ורבע",
          "group": "frac",
          "icon": "pie",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "d7896eb1f13b4184b6a3e96ae9535ccc",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "a74254204af944e88c91aed72daa6de8",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "b8cc96b907a344e1816b13b8f660cf7e",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 28,
          "title": "צורות וגופים לא אותו דבר",
          "group": "geo",
          "icon": "prism",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "01b8d86f2f174d18bbd0e95951e2bc5b",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "00c0c9f4dfec435782b4a9b3c0ea9148",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "c0129c9cdcbe4107930bc784dcf9b7b5",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 29,
          "title": "סימטרייה שיקופית אינטואיטיבית",
          "group": "geo",
          "icon": "mirror",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "c0c8fae7f9324aa7841a177a50d116d7",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "4093188d300f4529acccd64aeb2d0b52",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "c23f3e4b17864cb7ba5c4191fe31df70",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 30,
          "title": "סיכום מספרים פעולות וייצוגים",
          "group": "think",
          "icon": "numline",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "6b04b33cf8d345ba80609603df46135c",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "92c54eeada9747f8bdcd2d4d5dbff37b",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "c78d2c887e5f48a9bed79c237a138328",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        }
      ]
    },
    {
      "grade": 3,
      "label": "כיתה ג׳",
      "emoji": "✏️",
      "groups": [
        {
          "key": "num",
          "label": "מספרים וערך מקום",
          "reducedProgram": false
        },
        {
          "key": "ops",
          "label": "חיבור וחיסור בטור",
          "reducedProgram": false
        },
        {
          "key": "muldiv",
          "label": "כפל וחילוק",
          "reducedProgram": false
        },
        {
          "key": "frac",
          "label": "שברים",
          "reducedProgram": false
        },
        {
          "key": "word",
          "label": "בעיות מילוליות",
          "reducedProgram": false
        },
        {
          "key": "geo",
          "label": "גיאומטריה",
          "reducedProgram": false
        },
        {
          "key": "meas",
          "label": "מדידות, היקף וכסף",
          "reducedProgram": false
        },
        {
          "key": "data",
          "label": "נתונים",
          "reducedProgram": false
        }
      ],
      "topics": [
        {
          "id": 1,
          "title": "ערך מקום",
          "group": "num",
          "icon": "table",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "66ff70bda98c40d4a27be64f6351d21f",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "a53c73dd570241fa86392f06b42036e8",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "0c52fba6ca724f3ba8cf7347e1a06913",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 2,
          "title": "שכנים וישר מספרים",
          "group": "num",
          "icon": "numline",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "2f85744f4f5b4fd3aaef823b399099a3",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "4d5649341a3c43e788bd828961fd1dda",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "24aebdcd8b344b14bd27b9c4cb441325",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 3,
          "title": "סדרות ואיתור טעות",
          "group": "num",
          "icon": "steps",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "c74090e51f8747bdb43cba6c9690ce73",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "7e2b555b1e7044aaa81d5661db940da0",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "f7215421b05142288d9480138282d7e1",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 4,
          "title": "אל הרבבה",
          "group": "num",
          "icon": "table",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "07c4554866c94e1c8d161431c5b2c146",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "7779f3290cce45bf89d246941a821aaa",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "8a2718a7bd0c4e01a7900013b4ad3876",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 5,
          "title": "אומדן באמצעות מספרים קרובים",
          "group": "num",
          "icon": "magnify",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "63cd209d97604f10941ce63115d8d0e5",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "4e226ab096ab4f22a1019bc81e542401",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "4d27373122ac435c86b829cce5b42eb5",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 6,
          "title": "חיבור בטור עם המרה",
          "group": "ops",
          "icon": "plusminus",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "0069f3da129040e9a2b13485e509a63f",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "4472f21222ff44e7adb3aa5cefa91435",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "d01624a6c4fa4e90a28b931d857d3c9d",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 7,
          "title": "חיסור בטור עם פריטה",
          "group": "ops",
          "icon": "plusminus",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "df720cd2c2ef44f585c82442de7d976e",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "16d2f551bfa24240b2bb8df966c39684",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "22813f57f1034c7b80df73e6e9496470",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 8,
          "title": "בעיות מילוליות",
          "group": "word",
          "icon": "speech",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "d20fd2994fe64cd3997be592ef561653",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "52340dcb35954cc8bdfe933387bf16e1",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "1296a0ef1ab440d68f1e3c9e10425c97",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 9,
          "title": "כפל עובדות ומבנים",
          "group": "muldiv",
          "icon": "times",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "48426185c96d4a0ca1006f514d155757",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "0d6297f14d4149e2b2e2e2bc67b386c4",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "fc80e342c58e4cb2b154216fd3095612",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 10,
          "title": "חילוק והקשר ההפוך לכפל",
          "group": "muldiv",
          "icon": "times",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "3f0c8c1007de4a3f8443c1533db78c27",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "aed63e1684d245c19ec6f26ee9c550ee",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "ef2518919d284820a6f47041cbdebbd8",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 11,
          "title": "שברי יחידה וחלק משלם",
          "group": "frac",
          "icon": "frac",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "ce932ef443044f35a4c07f938bf954f0",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "a0977442f65941728bdbb3e5f0a2ce83",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "3d56bca1424241c29d27bdf2fda0daef",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 12,
          "title": "זווית וסוגי זוויות",
          "group": "geo",
          "icon": "angle",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "fc9ac60445034ae3b14df378e6f88c31",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "657a905ab8ff4bdeb6820b6c4aa3c7f2",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "b43f610e710e4cc8961cec0a70295b09",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 13,
          "title": "קווים וזוויות בצורות מוכרות",
          "group": "geo",
          "icon": "angle",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "9368ab7efd874203bf1b2af0a856095f",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "74f50f6482714a08b168c9cf6daf3243",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "723cb10975aa4de58d642aa1f33b0a1c",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 14,
          "title": "מצולעים צלעות וקודקודים",
          "group": "geo",
          "icon": "pgram",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "dce1ebf1e14541f58d5ada9918a1e97e",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "da60eb1557e04c9e88b767bfda4a7d12",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "933a9edea1c14d7995f78b7c6bc07ad6",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 15,
          "title": "היקף מצולעים",
          "group": "meas",
          "icon": "dashrect",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "378bef85fabb46fc8c43643a7cd359a6",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "a6a7a4b41ca44748aee41a0dd543af36",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "b9c3490dc28d40c984b3be67484b48d0",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 16,
          "title": "מיון משולשים",
          "group": "geo",
          "icon": "triangle",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "34fb40e50c854fabaa83199ca2df304a",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "6a8bed02a0574351901c2e1c80b8f0a8",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "e98f0207a4f44047be6953d6d36fcbcc",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 17,
          "title": "מרובעים לפי תכונות",
          "group": "geo",
          "icon": "rhomb",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "5c22657a94a742679fe08930f129e185",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "f47d2401257a4618966a8363e5c4d922",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "4bf8a12b04f54b3495a28c4eb7c59aa1",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 18,
          "title": "צורות על רשת בנייה ופירוק",
          "group": "geo",
          "icon": "lshape",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "021771df01a74ae9a428edb797bbb58d",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "2c26dd7de5934e5b968464339dc449f2",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "c1285207887d425581319a8eaafcfbc5",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 19,
          "title": "מדידות זמן ומשקל",
          "group": "meas",
          "icon": "clock",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "a480f051c7344ba2ab8fd3935c09faa7",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "5bbc525274c241fcbe747582964ece8a",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "2e182f19f2c54e76beb131f96776c21e",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 20,
          "title": "קוראים דיאגרמה",
          "group": "data",
          "icon": "bars",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "0efc9bdb7f8c4350b067c45ae2f68a3e",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "bddfb8950fdd49ba9e5feb0a6fdbb672",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "e6fae3d718084454ba5a185b3a9f14a2",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 21,
          "title": "חילוק ובדיקה בכפל",
          "group": "muldiv",
          "icon": "times",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "9d3d0401daa04cc3be88e8808c3b40e6",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "c42b75328efd445291200ee1d3863413",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "2eb3cb61a60c45b19ead8566f7935cd2",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 22,
          "title": "מדידות אורך ס״מ ומטר",
          "group": "meas",
          "icon": "ruler",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "6a67cc3a2dcb42fab7537202b29a38fb",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "757e3ad1371f4909b7db99e9bb7f3534",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "313a4acb03174a308c9ea36198767aec",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 23,
          "title": "בונים ומפרקים צורות",
          "group": "geo",
          "icon": "branch",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "0b994dcbd85348e7aba548cfa7415f4e",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "35dd261b6c684d30b0b0667430609c90",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "f2e2546357d7418e86517688f4aec048",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 24,
          "title": "אוספים נתונים",
          "group": "data",
          "icon": "bars",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "73ee7605ba8f442db3725b63eae596b0",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "3ee8b06ccfa6415ca9fc87eafa0cd2b1",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "6c93f766bbed4704b34ef616cf3b2281",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 25,
          "title": "כסף",
          "group": "meas",
          "icon": "tag",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "73a80adfc4224048a655c97968271658",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "0cc40c26e42748188b1661bde49059f1",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "43edba2842ed4083ad4f6c847665c9b8",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        }
      ]
    },
    {
      "grade": 4,
      "label": "כיתה ד׳",
      "emoji": "📐",
      "groups": [
        {
          "key": "num",
          "label": "מספרים גדולים",
          "reducedProgram": false
        },
        {
          "key": "ops",
          "label": "חיבור וחיסור",
          "reducedProgram": false
        },
        {
          "key": "muldiv",
          "label": "כפל, חילוק וסדר פעולות",
          "reducedProgram": false
        },
        {
          "key": "frac",
          "label": "שברים והתחלקות",
          "reducedProgram": false
        },
        {
          "key": "geo",
          "label": "גיאומטריה",
          "reducedProgram": false
        },
        {
          "key": "meas",
          "label": "מדידות, שטח והיקף",
          "reducedProgram": false
        },
        {
          "key": "data",
          "label": "נתונים",
          "reducedProgram": false
        },
        {
          "key": "synth",
          "label": "סיכום",
          "reducedProgram": false
        }
      ],
      "topics": [
        {
          "id": 1,
          "title": "מספרים עד מיליון קריאה ופירוק",
          "group": "num",
          "icon": "table",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "c16511e176924a3abe9e7a78d84282b6",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "fd79ec99777644aaaa82aca99741e72d",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "3fddf5c02e2745eca67a93ac3e063172",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 2,
          "title": "סדר שכנים ועיגול בתחום המיליון",
          "group": "num",
          "icon": "magnify",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "d26febce53e54be6aeb8240f0b4905f1",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "ee9199cf8ed147cb88d0af902cc01eda",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "52fb4917a43c475abb8a2155fbec6ed5",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 3,
          "title": "חיבור רב־ספרתי בטור",
          "group": "ops",
          "icon": "plusminus",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "cde64aee2b8a41b09c97a2e926ed3c6f",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "bf1bdd58f069427096a5fcaac0963e2a",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "2a812c5935904d7c9192e3e6c51a85e1",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 4,
          "title": "חיסור רב־ספרתי בטור",
          "group": "ops",
          "icon": "plusminus",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "9db72eb2e73843ad883097dfe7052e88",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "e2a3037f4afe475bb4f5b5e36ba35b83",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "cc48ddaf044840aaa1e5416ad61b87da",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 5,
          "title": "אומדן ובעיות חיבור וחיסור כולל כסף",
          "group": "ops",
          "icon": "tag",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "e0e9707b398b44e2bc899bf2b408d49e",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "13de751b05d54280890a64d482642333",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "69f8cea0ad6a40d993ce9a57021065a8",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 6,
          "title": "חוקי פעולות וכפל בעשרות שלמות",
          "group": "muldiv",
          "icon": "times",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "6c79037d21dd4fe99490ff36f872648a",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "c22a0ce64c4e49e7b3750e7646e34b07",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "4a466ab88c3944018b9320d87f205120",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 7,
          "title": "סדר פעולות חשבון",
          "group": "muldiv",
          "icon": "parens",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "8e770368a7e24c6c8324edd1883a798e",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "c7b4c06938c4452ab3dd6c437cc4f02b",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "8f879a4de7ae40c3a8a95b01cc4228b0",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 8,
          "title": "חוק הפילוג ומכפלות חלקיות",
          "group": "muldiv",
          "icon": "times",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "072388651e114a7db4521b071b3090b0",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "5c95fe7a3cef46dc96cd171898e33e05",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "8fde5d2774f849bab4c8176a77594451",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 9,
          "title": "כפל רב־ספרתי",
          "group": "muldiv",
          "icon": "times",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "4fb55b64601c4b39a715cd10d9d8fd19",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "38d3852173d642e195771f0bfc4466c2",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "1a157b4d67f64b21aa0662fb413ffe3c",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 10,
          "title": "חילוק ארוך ושארית",
          "group": "muldiv",
          "icon": "divide",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "cd932c0513b24262873c39811d9ba7ee",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "53c57aa1d85f45288d4ffe7e2bb11636",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "008d194c4d044e529b83263797f12111",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 11,
          "title": "שבר ייצוגים ושמות שקולים",
          "group": "frac",
          "icon": "frac",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "3b791261d41b449ba45a234b5294483d",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "5609e8d80c0b43a2bdaaebb90c5f76f8",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "6f03feb428164154b271cd13b1ca2513",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 12,
          "title": "שברים על ישר והשוואה",
          "group": "frac",
          "icon": "frac",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "c4ade11dcb7e42d6987b3eabd71308ad",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "ed260cae5fdb4600a39d200f780df02e",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "a406072c341a415a8c124b6e3f926e57",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 13,
          "title": "שברים שקולים ייצוגים השוואה וישר מספרים",
          "group": "frac",
          "icon": "frac",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "de12590ded914d43befe73a56d895911",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "9c51d628e5bf4f80867f11dd880056b7",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "8b48931495a047dda84f77d29f1a57cb",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 14,
          "title": "התחלקות וגורמים",
          "group": "frac",
          "icon": "factor",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "36a5228a38944129bdce2e255d85173f",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "2f33fa07b41046d095b12eab168d75c8",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "7fd0038b766a4bc9b2fbfd051384e10a",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 15,
          "title": "מספרים ראשוניים ופריקים",
          "group": "frac",
          "icon": "factor",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "fe8c1a1691db42189124f2752c9f3f3b",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "60965c8bfc754177a0450b2520a86f5c",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "2d7676a1741748bba7e52986d7d25810",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 16,
          "title": "מקבילים ומאונכים בצורות",
          "group": "geo",
          "icon": "lshape",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "2dd7240572dc41e3a320d6ab258c53aa",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "edf4cee1f5d44bab92eeed9302bd122e",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "889384e085ab494789e861613537fb2f",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 17,
          "title": "מצולעים ואלכסונים",
          "group": "geo",
          "icon": "pgram",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "0bea028f4c2f48e68b0f9ccd4d346af4",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "7349dbab99604336bb5fca936829ca64",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "5ca4a4392fc84c9496fc7e2fdbbc14da",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 18,
          "title": "מלבנים ריבועים ויחסי הכלה",
          "group": "geo",
          "icon": "ratio",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "c9ba5991de514567a44f08062a908023",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "42e3101305374c1890f9f10d550b13ca",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "b2701fb979b145818365c44a71d09015",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 19,
          "title": "סוגי זוויות",
          "group": "geo",
          "icon": "angle",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "e878b597f9a74401987780ff36935b80",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "d3b1fd9ed32a4c8192201c136c708120",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "6315abb98cd443d99574fc98ddadeb4c",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 20,
          "title": "מיון משולשים",
          "group": "geo",
          "icon": "triangle",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "716d152915294437b1348099f1333305",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "2f51d11167664fa8ac6e27cba9863e6d",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "12e990a6cb384855965c63e8d7233698",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 21,
          "title": "יחידות אורך והמרות",
          "group": "meas",
          "icon": "ruler",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "d8fe9431a9a4441cbff7804ca36bb39a",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "7f133278fe38497884f68569c5e4451d",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "01facc4c8984418f95f7cacd383627ff",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 22,
          "title": "שטח והיקף של מלבן וריבוע",
          "group": "meas",
          "icon": "gridrect",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "c902d595f9ce4449bdf568984b0c0484",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "2dfc0404b46f4e02981de187d7eedd46",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "7e7c36bd45ec4b75bb1fe791a3056c2e",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 23,
          "title": "שטח והיקף של צורות מורכבות",
          "group": "meas",
          "icon": "gridrect",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "a06f892b214b4bbd9f2670e17390ac43",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "d427fe58f1c6442eaa54ad127c1675d8",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "9a4a52fdde994bc09ed26d64f1a60e91",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 24,
          "title": "זמן ומשקל המרות ויישום",
          "group": "meas",
          "icon": "clock",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "8f1a456bddbf4da1823d873cadd80bc0",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "e3ee1aa0fb95439e8e113026676b5c90",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "88febedf1f964eef9bb04ad189ada3d4",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 25,
          "title": "דיאגרמות ומסקנות",
          "group": "data",
          "icon": "bars",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "22d109068cb64697aac959e4b8f9006c",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "357825c14da54b359435cc64150fa64b",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "69e5180c0bba4c138759dcee7ecff140",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 26,
          "title": "סימטריה שיקופית וסיבובית",
          "group": "geo",
          "icon": "mirror",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "f5b5667b73704755b1a658c7fa5b52fa",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "ba87adbaa6cf45d5bfe7580006620b0d",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "7cd1538324c14ae9b73e98c493b847cf",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 27,
          "title": "זוויות וקווים במישור",
          "group": "geo",
          "icon": "angle",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "bb7ea15a7288433e8f20b3a761700082",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "97a78f8ad7e14537964b08fd496ca8ad",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "af8f6ce5baa34773873d858dfd9fe5ab",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 28,
          "title": "משולשים מיון ובנייה",
          "group": "geo",
          "icon": "triangle",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "5794d9b0846c4859bfee8541e77ee3f6",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "474a51d8ec314fcf98a43d2c0bf49e91",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "ac71f6b3330444b3b1004cb82a889001",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 29,
          "title": "מרובעים תכונות מיון והכלה",
          "group": "geo",
          "icon": "rhomb",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "07de1dbfc6f644d7a25ca965d0e19cb2",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "2bb8285cc3e54277ab2f3be506f8291c",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "394f29b6dba242989bdadf18503f35df",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 31,
          "title": "דף סיכום אינטגרטיבי לכיתה ד׳",
          "group": "synth",
          "icon": "book",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "ef716fba16f84b7f9d31bd4a14f2eff5",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "92f2188824954405a7eb673878682c77",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "858f257962a94f04adf6327e7093592f",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        }
      ]
    },
    {
      "grade": 5,
      "label": "כיתה ה׳",
      "emoji": "📊",
      "groups": [
        {
          "key": "num",
          "label": "מספרים ופעולות",
          "reducedProgram": false
        },
        {
          "key": "frac",
          "label": "שברים",
          "reducedProgram": false
        },
        {
          "key": "dec",
          "label": "מספרים עשרוניים",
          "reducedProgram": false
        },
        {
          "key": "geo",
          "label": "גיאומטריה",
          "reducedProgram": false
        },
        {
          "key": "area",
          "label": "שטח והיקף",
          "reducedProgram": false
        },
        {
          "key": "meas",
          "label": "מדידות",
          "reducedProgram": false
        },
        {
          "key": "data",
          "label": "נתונים וחקר",
          "reducedProgram": false
        }
      ],
      "topics": [
        {
          "id": 1,
          "title": "תובנה מספרית כפל וחילוק בעשרות ומאות",
          "group": "num",
          "icon": "times",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "279ea200737b44ea9acf275831d7d19c",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "7af64cc15ad24446a4537764553ecb79",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "567aa489fe4c40ed8563025260dfee0d",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 2,
          "title": "מספרים גדולים ערך מקום עיגול ואומדן",
          "group": "num",
          "icon": "magnify",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "4abf84de7ce24b71bf5e47603d0334d7",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "a213cee8e0a1449e901f12cc721a8e61",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "a6558c915cca42309e2dd7e37909709f",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 3,
          "title": "כפל רב־ספרתי ובדיקת סבירות",
          "group": "num",
          "icon": "times",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "082390d2a73b4c13a910df1551114223",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "7613788163e34cfdbdf102bb21d98087",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "34f133f69bdf4af0b504ae88a6106b2f",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 4,
          "title": "חילוק מאונך ושארית",
          "group": "num",
          "icon": "divide",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "5eb8668453e84edf873af87c12dccec6",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "6f5d93961b5c4e93bdc2b418afd3f4eb",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "42701040b879426c943ea19441246e1b",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 5,
          "title": "גורמים ראשוניים ופריקים",
          "group": "num",
          "icon": "factor",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "9bc70aca2e45443ba589470f6b69dba5",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "01c53f1a499a4d418a5c4f7f80122151",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "15486a3c194d47019c50e32e5f34f62d",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 6,
          "title": "סדר פעולות תכנון ולא רק ביצוע",
          "group": "num",
          "icon": "parens",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "bf087bb730f3462fa6524835a8b516b7",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "d52fa784e0bb409c8a4608fd9fb0122c",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "ce4e08353f4548ab9f4fe8d678664e99",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 7,
          "title": "חזרה על משמעות השבר וייצוגיו",
          "group": "frac",
          "icon": "frac",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "cd700d350f67411a803741ae1e2dc9ec",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "972a0329aa4d422abeb985816a36db35",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "4b1967df36dc49db91ab058391ab8305",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 8,
          "title": "שברים על ישר והשוואה",
          "group": "frac",
          "icon": "frac",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "10477353cde545bdba613b4c853a5a09",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "786fa82f879f42f9b6262b27b6fe60ac",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "c279e6a077444ecdbe1d0d0b3e04acb3",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 9,
          "title": "הרחבה וצמצום שברים שקולים",
          "group": "frac",
          "icon": "frac",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "5dcead75ede34b7892fffdea2bb20087",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "cfc6da608a8d4950a8d479f387d89e04",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "bc001edd88854c548d59dbf87f19be35",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 10,
          "title": "מכנה משותף בחירה יעילה",
          "group": "frac",
          "icon": "star",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "1e4cc091f6fb4addb3084537871187e3",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "6a2abc6e28534321a3af4d7ada2b13d7",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "8768da1fb9c44b828daf3a58aeb1448b",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 11,
          "title": "חיבור וחיסור שברים במכנים שונים",
          "group": "frac",
          "icon": "frac",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "bb0f9ce2918747a49111d8e944f55c97",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "047b3cf13c684c76a7a130f8e66a94e2",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "78519b006ef14eb08824825e7dc11888",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 12,
          "title": "חלק מכמות",
          "group": "frac",
          "icon": "star",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "65e887ce5770403abca2892741876bc4",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "22cbc9d3ac124e41abc40d0e762c3d27",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "e403744f65f64642aa9228e059ed6afb",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 13,
          "title": "שברים גדולים מ־1 ומספרים מעורבים",
          "group": "frac",
          "icon": "frac",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "6e27197feecc46c3a901b89bd78d0798",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "196bae675c754d98af1a454966bf91ae",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "4b9d564658a847e19435a7d2a7658290",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 14,
          "title": "חיבור וחיסור מספרים מעורבים",
          "group": "frac",
          "icon": "plusminus",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "e5be02dde9a4485ea3cfd2977e5c4987",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "d81a4bd4b7c34662a7a968ddb23831d5",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "60e91f28456d49cabe5bca5a95bf1cc2",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 15,
          "title": "השלמת שברים ופעולות הפוכות",
          "group": "frac",
          "icon": "frac",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "8ce5045097ae4b5685a0ac5425e8fdca",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "e69b17161f424491ae34aeb24f225d1b",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "fa4391c3bd5d4dc2a8bbe59b4df98a6e",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 16,
          "title": "קריאת טבלאות וחישוב נתונים",
          "group": "data",
          "icon": "table",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "9f2d74bca9b74a22a17156cfcf2866ce",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "255386dbf0ee4256aed11861c856b27a",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "a10761363a324da3874435f23c85b474",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 17,
          "title": "קריאת גרפים והשוואת נתונים",
          "group": "data",
          "icon": "bars",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "5f00f26f765f48c091df28fa5389c229",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "56f620d49a0d42c78624e80386aea3e0",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "c869e3f60ef44488ad751e95f32e8b0b",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 18,
          "title": "משפחת המרובעים ויחסי הכלה",
          "group": "geo",
          "icon": "ratio",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "f11e6c74021b42fbba74b9eba971af8d",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "eeea738783c04c01a14578a599a968a6",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "17be3972a889401091b468d8e5e04bf2",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 19,
          "title": "תכונות ואלכסונים במרובעים",
          "group": "geo",
          "icon": "rhomb",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "2f49fcbedaa34f1b9997341d7e077362",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "166f6c3d4124433788bae2e23819f9b0",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "4a4b639ca2fb4a2395cf6aef67d6e234",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 20,
          "title": "בניית צורות ומיון לפי תכונות",
          "group": "geo",
          "icon": "lshape",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "b305c04c17ad4ba4b7021b6be273ea87",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "fc7dc71e88f24a25bd9947a7ce052577",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "e20c9ddfd2dc4868a87eeb3cf3bd62cf",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 21,
          "title": "המרות יחידות ומדידת משקל",
          "group": "meas",
          "icon": "ruler",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "a016c68e75be4ee180c4d4c44d531e06",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "3aaf47cac9444a96969e48425ceee23a",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "9393231770ca4aceabbcc28b59498533",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 22,
          "title": "היקף יחידות וקווים מקבילים מאונכים",
          "group": "area",
          "icon": "dashrect",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "fa55e7cc520342109df6766b39fe126a",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "d5ee1fa37f0144aaaa3a3dfb9ba1b16a",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "c3aeb7e6bf444fcea376c1ae3b13bb8e",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 23,
          "title": "גובה במשולש חד־זווית וישר־זווית",
          "group": "geo",
          "icon": "angle",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "5faf61b196664f3bb38a3feadec6e1f9",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "f448dc893ff847feaf99370c191efcee",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "c3ef78e93744461bb897d2013e39bd68",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 24,
          "title": "גובה במשולש קהה ובמקבילית",
          "group": "geo",
          "icon": "triangle",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "2896006711854b278551cbc6dfcb1324",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "34d92d0ef47a4fcba3787efe8ede83f2",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "b21a2953c0fd469d996f634046be8c63",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 25,
          "title": "שטח והיקף של מלבנים וריבועים",
          "group": "area",
          "icon": "gridrect",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "82731f6bb0ea47a1b634e947ae150a51",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "c02475c752324cf3a82e41bfa94b1f48",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "1761d0555172444085209da34f977922",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 26,
          "title": "שטח צורה מורכבת פירוק והרכבה",
          "group": "area",
          "icon": "branch",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "d26b17230aaa4eb9b98374c78ac96868",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "d7bf6b38debf497880eb0cbe48b580b4",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "bd52f3b243d640d4aaaff6bd545875da",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 27,
          "title": "שטח מקבילית והקשר למלבן",
          "group": "area",
          "icon": "gridrect",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "37dab7d711124e378702a495eab046c8",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "5512b7ecabe44c5792de1a1a93f67d8a",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "b2bfaafd50d94895b6e06072540fccc9",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 28,
          "title": "מספרים עשרוניים ערך מקום וייצוגים",
          "group": "dec",
          "icon": "frac",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "1d9b2d11ec6e41b3b1c7233464e30413",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "7106b4638b2c4bb9b81b0fc668f898dd",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "afd18b2fd1434bcb92b39ae7a46ae8c1",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 29,
          "title": "משווים שברים ומספרים עשרוניים",
          "group": "dec",
          "icon": "frac",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "c82a4f617f9340adbd493f55c2f30ec0",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "cf88e6fe5db74a37a167d388e32b5bda",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "c4aeefcd86e541f38d3d3d6d88e38b27",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 30,
          "title": "חיבור וחיסור מספרים עשרוניים ואומדן",
          "group": "dec",
          "icon": "frac",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "c959c7a8f4064a0db9dc7b9b3af42a09",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "0dec15979b9f424e9e1a12484f33cd74",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "a3b676973d404e52abf3a94a02527040",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 31,
          "title": "שטח משולש בסיס וגובה",
          "group": "area",
          "icon": "gridrect",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "0df19a15439844c19046824b58d839ff",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "a5d5558f754d4af9ac9a8bd5bde8966d",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "8be63237709b4eb1a5574b8f65097850",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 32,
          "title": "נעלמים ומשוואות בשברים",
          "group": "frac",
          "icon": "frac",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "fa8592180c5a42f9bf77b69bf9e4993d",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "62c5fcb4518e4b16bb70194bb635a320",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "435846964cae4c21bf8fa6685bc9f89a",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 33,
          "title": "ממוצע וחקר נתונים",
          "group": "data",
          "icon": "bars",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "25a35bec1b9b4104892ce769859a6512",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "207e690c250944928d94ddb2384ec7d8",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "ff4c197865614c76b543d1546f4b4c7a",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 34,
          "title": "שכיחות סיכוי וזמן מתוך נתונים",
          "group": "data",
          "icon": "clock",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "a026f35df72e4a2488e5dbdac76cfcb9",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "f46b9f920bde495497cc05b2c76d6e7e",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "f2ab05fea8574817afa0fa8c205c7341",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 35,
          "title": "שיקוף סיבוב והזזה",
          "group": "geo",
          "icon": "mirror",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "5c162439c4464cc5beeaafd6645464dd",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "1de7ecd9b3ec44a4a183002b4475ad4c",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "a1a015a125c442d68ba44a6890cbc5fd",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        }
      ]
    },
    {
      "grade": 6,
      "label": "כיתה ו׳",
      "emoji": "🚀",
      "groups": [
        {
          "key": "fracmul",
          "label": "כפל וחילוק שברים",
          "reducedProgram": false
        },
        {
          "key": "dec",
          "label": "מספרים עשרוניים",
          "reducedProgram": false
        },
        {
          "key": "solid",
          "label": "גופים, נפח ושטח פנים",
          "reducedProgram": false
        },
        {
          "key": "pct",
          "label": "אחוזים, יחס וקנה מידה",
          "reducedProgram": false
        },
        {
          "key": "geo",
          "label": "גיאומטריה",
          "reducedProgram": false
        },
        {
          "key": "num",
          "label": "מספרים ופעולות",
          "reducedProgram": false
        },
        {
          "key": "data",
          "label": "נתונים",
          "reducedProgram": false
        },
        {
          "key": "synth",
          "label": "סיכום וחשיבה",
          "reducedProgram": false
        }
      ],
      "topics": [
        {
          "id": 1,
          "title": "כפל שבר במספר שלם",
          "group": "fracmul",
          "icon": "frac",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "83109f8e238549a3bdc19f79108144cb",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "4b290d5f7ff84bba92a8922754904fc8",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "a338383a6d6840deb2034c5c1aee7d2d",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 2,
          "title": "כפל כחלק מכמות ושטח",
          "group": "fracmul",
          "icon": "times",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "fb7b23a6ba0148a1b3214b2bded38404",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "0a4f563e6e524a4197827361d4beba41",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "3006527c1a284acd82fa8d3666ec2b38",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 3,
          "title": "כפל שבר בשבר",
          "group": "fracmul",
          "icon": "frac",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "0b5f334408b54a6296ae689cd3825c14",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "f9601108b5c041018a64abfcfadd3c70",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "7293e2a2261f426fbdda52a3fee8f0da",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 4,
          "title": "כפל מספרים מעורבים",
          "group": "fracmul",
          "icon": "times",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "e38b2869141b41fb9f000c5cd3dcad50",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "38e317b81414403db63211a098802715",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "5e27f374f1174eb5bb599e0f376b44d7",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 5,
          "title": "כפל שברים יישום ובקרה",
          "group": "fracmul",
          "icon": "frac",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "5887c0d0837b464a9fa34a05ddea50d0",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "d6daf1c7a6704c19aae5d63c82bff8db",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "8ef7dfbb350a4928a398258415f2f192",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 6,
          "title": "משמעות חילוק שברים",
          "group": "fracmul",
          "icon": "frac",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "c57518a2c69e482685be059fec68470a",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "3701d63874d341b8aac8d529b4cebcd6",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "88fd2c8e7b7344108109d63c556ca435",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 7,
          "title": "אלגוריתם חילוק שברים והופכי",
          "group": "fracmul",
          "icon": "frac",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "c73305ad3c064839bf4375ee1cb23f29",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "0be14af5dc214d23975e51eb5050bd36",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "43c898389ca74873a6972e49f6ae024e",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 8,
          "title": "כפל וחילוק שברים בחירת פעולה",
          "group": "fracmul",
          "icon": "frac",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "f163f83d87f849f4b981db6ee2722269",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "96d53ded6e0044dfb07e32ef87d7941f",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "46df9eaca3ff48b581474f29bab19c80",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 9,
          "title": "כפל מספרים עשרוניים",
          "group": "dec",
          "icon": "frac",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "1ea1f15a94f34e66b8c2be73548ffc5a",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "f7e52398769742119ef519ca780a2910",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "2feaa550e5624413850647e884ea7076",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 10,
          "title": "חילוק מספרים עשרוניים",
          "group": "dec",
          "icon": "frac",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "512187a59bb74fc1aea64cc35aa5a23f",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "37bc30ee47e147b082dbd33af980a151",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "7ad8b30e2e8f4e64b089a3233e7e6beb",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 11,
          "title": "חקר גופים ותכונותיהם",
          "group": "solid",
          "icon": "prism",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "a373338a56b04c8a8252aaf5cb15e36a",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "0977e97f7d95447585aab8b01270ca3d",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "a9e9bcfb23534a17aee0c47ff808a22d",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 12,
          "title": "תיבות ופריסות מעבר בין דו־ממד לתלת־ממד",
          "group": "solid",
          "icon": "cube",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "26eedcd10ea64b7e9994367bfcd90c33",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "4cbce46755aa48bdb2637ab19efabe5a",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "2a659fe72592474693a00b469687867b",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 13,
          "title": "שטח פנים של תיבה",
          "group": "solid",
          "icon": "cube",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "b974946af46b47f3b95da3d76c9bb7d8",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "b1e3a1e58df2423fbbe265dc84eba96d",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "6a828a45dba340c190817ed516eea6b2",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 14,
          "title": "נפח תיבה ומבנים",
          "group": "solid",
          "icon": "cube",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "73c7da8297034ae885f2f12d9de66e68",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "9afd181d018240c7a4421edf5cacf1d7",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "e224d2095c3640e6b17f36cc113d3663",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 15,
          "title": "קיבול סמ״ק ליטר ומ״ק",
          "group": "solid",
          "icon": "cyl",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "88fdc091ceb04702a8c386094cb97627",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "bfd3f3ca19da48c4afb5038ff159fa7d",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "73a2e04f778643e2ade45ba38ffb242b",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 16,
          "title": "מרובעים ויחסי הכלה חזרה מנומקת",
          "group": "geo",
          "icon": "ratio",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "bbf3d375a36f4fd1a609bb875822f059",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "d8b002095de6412ab85048f3910e60df",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "d00ead119d7a4edf975eee7b7698bb1a",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 17,
          "title": "דף סיכום מדידות גאומטריה ופתרון רב־שלבי",
          "group": "synth",
          "icon": "ruler",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "37bd6cb1cf224c10bb5c352731e2bd5d",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "73dbb957351b4c4c818afc8694eedca8",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "85be0c2282a34d91b2fbdf474237077d",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 18,
          "title": "שבר עשרוני ואחוז שלושה ייצוגים לאותו מספר",
          "group": "pct",
          "icon": "percent",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "e85bc87a7bdb49d780d445b6d4a0eca3",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "0e4e3d1c0b744f4b982d5cab44aa1729",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "77aadbfee73a4d2fa104c5f2bd2b637b",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 19,
          "title": "אחוז כחלק מכמות",
          "group": "pct",
          "icon": "percent",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "3b2a86c6eda04c9f8306847cf8b3a1b5",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "e6085f0b07e9474a84bf173f1b6a2a79",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "2b940056be9b44b78c566b16ec2b452d",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 20,
          "title": "מציאת השלם ויישומי אחוזים",
          "group": "pct",
          "icon": "percent",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "b72fa1e34ff84f15802173f2dcf8dd0f",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "1229226e126b4a4b908488503eafcba4",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "1f47546e37aa40cf8814c485ee6a3e30",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 21,
          "title": "יחס משמעות ייצוג ויחסים שקולים",
          "group": "pct",
          "icon": "ratio",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "21d2e85e62174c03aaa3dde332f01552",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "ed6ea5745d3848768ab3eb8431330a93",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "e76fe2ed7c15497da019eb0989b0a0b1",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 22,
          "title": "קנה מידה במפות ובשרטוטים",
          "group": "pct",
          "icon": "map",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "044d3f37c6bd4fada6aa6192ba3d0fe3",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "0ec9f2398585408dada6611f6fa5557d",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "4d53088bd9ca4dee89007cc14a7a33c1",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 23,
          "title": "מספרים ופעולות סדר אומדן ובדיקת סבירות",
          "group": "num",
          "icon": "magnify",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "5845c92848604001a850327cc12b9233",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "144b323401d547b5b0d7251e415d701b",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "84592328cbd3460f9fa860ec5aa536f3",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 24,
          "title": "אוספים ומייצגים נתונים",
          "group": "data",
          "icon": "bars",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "7411d987d16044fd865e7a4388042850",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "0cae47513a4c4701add68eb94159551d",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "87c7df37ef5d4319badccbc7fb49ba35",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 25,
          "title": "משווים קבוצות ומנסחים מסקנות זהירות",
          "group": "data",
          "icon": "star",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "5c38d44d6eed4484bcb4dc43ea80f14d",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "91645de7a8294cbfb6c0643ce8a87949",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "cbb330d419134c1992b8e796aa47d836",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 26,
          "title": "שינוי ממדים מה קורה להיקף לשטח ולנפח",
          "group": "geo",
          "icon": "cube",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "b504d2a6490f4973b1608844220cb792",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "fb1ecc23a81946cf81e83dddf224da03",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "a4100c050b4f46e5bf3983256762dccf",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 27,
          "title": "חוקיות ופתרון בעיות רב־שלביות",
          "group": "synth",
          "icon": "steps",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "79cc6db7432d4fd6a683ef45980d4299",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "608ccf74446b420e8d28a36ba023e34d",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "325dbe7b49a341aebe80b552c9cd80ec",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": null,
            "aiHintShown": false,
            "usesViewer": false,
            "viewerPath": null,
            "siblingPdfQuery": {}
          }
        }
      ]
    },
    {
      "grade": 7,
      "label": "כיתה ז׳",
      "emoji": "🧭",
      "groups": [
        {
          "key": "m09",
          "label": "ספטמבר",
          "reducedProgram": false
        },
        {
          "key": "m10",
          "label": "אוקטובר",
          "reducedProgram": false
        },
        {
          "key": "m11",
          "label": "נובמבר",
          "reducedProgram": false
        },
        {
          "key": "m12",
          "label": "דצמבר",
          "reducedProgram": false
        },
        {
          "key": "m01",
          "label": "ינואר",
          "reducedProgram": false
        },
        {
          "key": "m02",
          "label": "פברואר",
          "reducedProgram": false
        },
        {
          "key": "m03",
          "label": "מרץ",
          "reducedProgram": false
        },
        {
          "key": "m04",
          "label": "אפריל",
          "reducedProgram": false
        },
        {
          "key": "m05",
          "label": "מאי",
          "reducedProgram": false
        },
        {
          "key": "m06",
          "label": "יוני",
          "reducedProgram": false
        }
      ],
      "topics": [
        {
          "id": 8,
          "title": "מערכת צירים — היכרות וקנה מידה",
          "description": "צירים וראשית, שיעורי נקודה, בחירת קנה מידה מתאים וקריאת נקודות.",
          "group": "m09",
          "icon": "axes",
          "noamTopicId": "G7-T08",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "b6b9bf5985484191b71c0c864fd04c31",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "c246ee5ec30f40489e3c1b6ac437c49e",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "1205b8cb8ca749ca89f0d34ac8dc508c",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G7-T08",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "b6b9bf5985484191b71c0c864fd04c31",
              "pb": "c246ee5ec30f40489e3c1b6ac437c49e",
              "pc": "1205b8cb8ca749ca89f0d34ac8dc508c"
            }
          }
        },
        {
          "id": 1,
          "title": "מספרים מכוונים — ישר המספרים וערך מוחלט",
          "description": "מספרים חיוביים ושליליים על ציר המספרים, מספר נגדי, ערך מוחלט, השוואה וסידור.",
          "group": "m09",
          "icon": "numline",
          "noamTopicId": "G7-T01",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "43054514a10645d993ce0fe08aa1d154",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "312d30c2d7764c34bd804f9b9f33fcbe",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "35202a955b8c422c84c87c99ae12f2d9",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G7-T01",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "43054514a10645d993ce0fe08aa1d154",
              "pb": "312d30c2d7764c34bd804f9b9f33fcbe",
              "pc": "35202a955b8c422c84c87c99ae12f2d9"
            }
          }
        },
        {
          "id": 11,
          "title": "זוויות חלק 1 — היכרות, סימון ומדידה",
          "description": "סוגי זוויות, סימון וקריאה נכונה, מדידה ובנייה בעזרת מד־זווית.",
          "group": "m09",
          "icon": "angle",
          "noamTopicId": "G7-T11",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "68e8bd8d0df0479cb4f8d2f5adc21020",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "019633ff4d054eb6aa84a5c32039f501",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "9b6fd164164b48848abf7aa82db2d8cc",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G7-T11",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "68e8bd8d0df0479cb4f8d2f5adc21020",
              "pb": "019633ff4d054eb6aa84a5c32039f501",
              "pc": "9b6fd164164b48848abf7aa82db2d8cc"
            }
          }
        },
        {
          "id": 2,
          "title": "חיבור וחיסור מספרים מכוונים",
          "description": "חיבור וחיסור מספרים חיוביים ושליליים, סימנים סמוכים, תנועה על הציר ובעיות מהחיים.",
          "group": "m10",
          "icon": "plusminus",
          "noamTopicId": "G7-T02",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "83a3b06973694b15802f1043da7ddabf",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "0acb5790d6d3433280de4e783969c488",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "d80559e91b1e45848a6421eceb6bd24c",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G7-T02",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "83a3b06973694b15802f1043da7ddabf",
              "pb": "0acb5790d6d3433280de4e783969c488",
              "pc": "d80559e91b1e45848a6421eceb6bd24c"
            }
          }
        },
        {
          "id": 9,
          "title": "הרחבת מערכת הצירים חלק 1",
          "description": "ארבעת הרביעים, שיעורים שליליים, נקודות על הצירים ושיקוף נקודות.",
          "group": "m10",
          "icon": "quadrants",
          "noamTopicId": "G7-T09",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "43da6c9c22de432881f2e830bbcdcb0f",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "c0c6b8226a604b829276ccc30b74710d",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "915c1de96cd24461944e5395a425b155",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G7-T09",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "43da6c9c22de432881f2e830bbcdcb0f",
              "pb": "c0c6b8226a604b829276ccc30b74710d",
              "pc": "915c1de96cd24461944e5395a425b155"
            }
          }
        },
        {
          "id": 12,
          "title": "זוויות חלק 2 — יחסים ופעולות",
          "description": "זוויות צמודות וקודקודיות, משלימות ונשלמות, חוצה זווית וחישובים.",
          "group": "m10",
          "icon": "protractor",
          "noamTopicId": "G7-T12",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "7f227ecdd0464e9fa3d6e28c4a692135",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "9d3bdc751726416a8bedb461c5f13eb8",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "cabe0ab7dd684950b6001ae73c70b70b",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G7-T12",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "7f227ecdd0464e9fa3d6e28c4a692135",
              "pb": "9d3bdc751726416a8bedb461c5f13eb8",
              "pc": "cabe0ab7dd684950b6001ae73c70b70b"
            }
          }
        },
        {
          "id": 13,
          "title": "זוויות — דף חזרה מסכם",
          "description": "חזרה על כל יחסי הזוויות, חישובים מורכבים וכתיבת נימוקים.",
          "group": "m10",
          "icon": "clipboard",
          "noamTopicId": "G7-T13",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "44f428b6cd75472988a512eea47a69fd",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "105e265953ec420494cb19d0f0ab63d6",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "29c273440e63440cbdc13c1e8daa3452",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G7-T13",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "44f428b6cd75472988a512eea47a69fd",
              "pb": "105e265953ec420494cb19d0f0ab63d6",
              "pc": "29c273440e63440cbdc13c1e8daa3452"
            }
          }
        },
        {
          "id": 10,
          "title": "הרחבת מערכת הצירים חלק 2 — יישום והעמקה",
          "description": "מרחקים בין נקודות, צורות במערכת הצירים וחישובי היקף ושטח.",
          "group": "m11",
          "icon": "analytic",
          "noamTopicId": "G7-T10",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "42d14e3577194ad883c2f2bcdffb141e",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "bc0639f3f80341fe96a9fa8c339efe7e",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "ba7bca690c5d48c0a4ca00eb38ef711a",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G7-T10",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "42d14e3577194ad883c2f2bcdffb141e",
              "pb": "bc0639f3f80341fe96a9fa8c339efe7e",
              "pc": "ba7bca690c5d48c0a4ca00eb38ef711a"
            }
          }
        },
        {
          "id": 3,
          "title": "כפל מספרים מכוונים",
          "description": "חוקי הסימנים בכפל, מכפלה של כמה גורמים ופישוט ביטויים.",
          "group": "m11",
          "icon": "times",
          "noamTopicId": "G7-T03",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "622c7814c15b4647b47339d5989d4430",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "b189a37abff04785af77f9aec17c0b8b",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "06c31cd5853a466eb664fdf8b9174c12",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G7-T03",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "622c7814c15b4647b47339d5989d4430",
              "pb": "b189a37abff04785af77f9aec17c0b8b",
              "pc": "06c31cd5853a466eb664fdf8b9174c12"
            }
          }
        },
        {
          "id": 4,
          "title": "חילוק מספרים מכוונים",
          "description": "חוקי הסימנים בחילוק, שברים עם סימן שלילי והקשר לכפל.",
          "group": "m11",
          "icon": "divide",
          "noamTopicId": "G7-T04",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "af4c2da1ae18423087edf01b8e1f36d6",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "ba1dcfbc19a24ae19c1260227725dc42",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "3cdf0cf512904354ba68a36728f246b7",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G7-T04",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "af4c2da1ae18423087edf01b8e1f36d6",
              "pb": "ba1dcfbc19a24ae19c1260227725dc42",
              "pc": "3cdf0cf512904354ba68a36728f246b7"
            }
          }
        },
        {
          "id": 5,
          "title": "סדר פעולות החשבון במספרים מכוונים",
          "description": "סדר הפעולות, סוגריים, חזקות וקו שבר בביטויים עם מספרים מכוונים.",
          "group": "m11",
          "icon": "parens",
          "noamTopicId": "G7-T05",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "67788949e19a4d49a98411b95f81a39d",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "790ee5d372854ef3b666bcc8b1fadf80",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "13d2014e544a48fd9fb7301ee8b446e2",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G7-T05",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "67788949e19a4d49a98411b95f81a39d",
              "pb": "790ee5d372854ef3b666bcc8b1fadf80",
              "pc": "13d2014e544a48fd9fb7301ee8b446e2"
            }
          }
        },
        {
          "id": 15,
          "title": "משולשים מיוחדים",
          "description": "משולש שווה־שוקיים, שווה־צלעות וישר־זווית — תכונות, זיהוי וחישובים.",
          "group": "m11",
          "icon": "tritick",
          "noamTopicId": "G7-T15",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "650ad39b6ea141b4b5c19e377c6e8544",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "5d08961c3e254034ae218fb538d92efd",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "f2d78978ee4b4674868c14eca5f8e535",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G7-T15",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "650ad39b6ea141b4b5c19e377c6e8544",
              "pb": "5d08961c3e254034ae218fb538d92efd",
              "pc": "f2d78978ee4b4674868c14eca5f8e535"
            }
          }
        },
        {
          "id": 14,
          "title": "סכום הזוויות במשולש ובמרובע",
          "description": "משפט סכום הזוויות, זווית חיצונית וחישובי זוויות במשולש ובמרובע.",
          "group": "m11",
          "icon": "triangle",
          "noamTopicId": "G7-T14",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "be2b444c8990401489f6b7cd5edb7e14",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "0f8f7a1ec0a246eaaf40492baf58459f",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "a1d2b5ea613744d09602119effdcb48e",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G7-T14",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "be2b444c8990401489f6b7cd5edb7e14",
              "pb": "0f8f7a1ec0a246eaaf40492baf58459f",
              "pc": "a1d2b5ea613744d09602119effdcb48e"
            }
          }
        },
        {
          "id": 17,
          "title": "מצולעים חופפים וטרנספורמציות",
          "description": "הזזה, שיקוף וסיבוב, זיהוי מצולעים חופפים והתאמת קודקודים.",
          "group": "m11",
          "icon": "twotri",
          "noamTopicId": "G7-T17",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "00469caa9cc343ab945e5a4a826b6a88",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "f07020b2f513422892b3a501513b5c34",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "7ce31c71cf7740d2b1b9452592eed853",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G7-T17",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "00469caa9cc343ab945e5a4a826b6a88",
              "pb": "f07020b2f513422892b3a501513b5c34",
              "pc": "7ce31c71cf7740d2b1b9452592eed853"
            }
          }
        },
        {
          "id": 6,
          "title": "חזקות עם מעריך טבעי",
          "description": "בסיס ומעריך, חזקת מספר שלילי, חוקי חזקות בסיסיים וסדר פעולות.",
          "group": "m12",
          "icon": "power",
          "noamTopicId": "G7-T06",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "2020207d65844bf0937db0f2c1f2fac2",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "18b45f3978cd46c1ae7016c4b0027efc",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "0c238e3787154354929cf137325a52ef",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G7-T06",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "2020207d65844bf0937db0f2c1f2fac2",
              "pb": "18b45f3978cd46c1ae7016c4b0027efc",
              "pc": "0c238e3787154354929cf137325a52ef"
            }
          }
        },
        {
          "id": 7,
          "title": "שורש ריבועי",
          "description": "משמעות השורש הריבועי, שורשים של ריבועים שלמים, אומדן והקשר לשטח הריבוע.",
          "group": "m12",
          "icon": "root",
          "noamTopicId": "G7-T07",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "48164ad3e5db498cae7ac08b3848816e",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "7a74d131052449089d3ef56a9f9b9ec8",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "ecf0ddf558114847a7515eb75432f2c8",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G7-T07",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "48164ad3e5db498cae7ac08b3848816e",
              "pb": "7a74d131052449089d3ef56a9f9b9ec8",
              "pc": "ecf0ddf558114847a7515eb75432f2c8"
            }
          }
        },
        {
          "id": 18,
          "title": "שטח מלבן וריבוע — העמקה",
          "description": "חישובי שטח, מציאת צלע חסרה, יחידות שטח ובעיות מורכבות.",
          "group": "m12",
          "icon": "gridrect",
          "noamTopicId": "G7-T18",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "23c37b41a1184705974a4e6e276cf979",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "f0bddd29b1474f23bf0984116c46854d",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "9b91eb7cc20b4ad9bc48ac99c4ac87cc",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G7-T18",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "23c37b41a1184705974a4e6e276cf979",
              "pb": "f0bddd29b1474f23bf0984116c46854d",
              "pc": "9b91eb7cc20b4ad9bc48ac99c4ac87cc"
            }
          }
        },
        {
          "id": 19,
          "title": "שטח משולש — העמקה",
          "description": "בסיס והגובה המתאים לו, גבהים במשולש קהה־זווית וחישובי שטח הפוכים.",
          "group": "m12",
          "icon": "tridash",
          "noamTopicId": "G7-T19",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "774110467ff449c7bd6b725471b735e7",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "4784c763764643fd8ff94c9af521ee85",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "35199bf6314c4a9ebbfd447b2c73a5d5",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G7-T19",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "774110467ff449c7bd6b725471b735e7",
              "pb": "4784c763764643fd8ff94c9af521ee85",
              "pc": "35199bf6314c4a9ebbfd447b2c73a5d5"
            }
          }
        },
        {
          "id": 22,
          "title": "משתנים וביטויים אלגבריים — שפה ומידול",
          "description": "מעבר מתיאור מילולי לביטוי אלגברי, משמעות המשתנה ומידול מצבים מהחיים.",
          "group": "m12",
          "icon": "box_eq",
          "noamTopicId": "G7-T22",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "9959d7d4fb0c4d47b228e5fb9abf73e1",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "41840861c0a4494f94f3a54fbd4d9943",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "90d77da84da74766aa7d844e5fd3faaa",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G7-T22",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "9959d7d4fb0c4d47b228e5fb9abf73e1",
              "pb": "41840861c0a4494f94f3a54fbd4d9943",
              "pc": "90d77da84da74766aa7d844e5fd3faaa"
            }
          }
        },
        {
          "id": 23,
          "title": "הצבה בביטויים אלגבריים",
          "description": "הצבת ערכים חיוביים ושליליים, חישוב ערך הביטוי והשוואה בין ביטויים.",
          "group": "m12",
          "icon": "arrowbox",
          "noamTopicId": "G7-T23",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "f8f637f884da4d118af1dcf13b3d688b",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "a08987eaf00849788ca1bdf0ff31692e",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "c8c7308d6b5a46d18032ecacfab4fe5b",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G7-T23",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "f8f637f884da4d118af1dcf13b3d688b",
              "pb": "a08987eaf00849788ca1bdf0ff31692e",
              "pc": "c8c7308d6b5a46d18032ecacfab4fe5b"
            }
          }
        },
        {
          "id": 21,
          "title": "חוקיות",
          "description": "זיהוי חוקיות בסדרות ובתבניות, ניסוח הכלל במילים ובביטוי אלגברי, מציאת איבר כללי והמשך הסדרה.",
          "group": "m01",
          "icon": "steps",
          "noamTopicId": "G7-T21",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "3eea0f90115e4a3f968a2148bffca11d",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "26b22710e551486d9e8b37a165d1590a",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "a78226524cf449ca955a36fc8a79ad24",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G7-T21",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "3eea0f90115e4a3f968a2148bffca11d",
              "pb": "26b22710e551486d9e8b37a165d1590a",
              "pc": "a78226524cf449ca955a36fc8a79ad24"
            }
          }
        },
        {
          "id": 29,
          "title": "שוויון ביטויים חלק 1 — כינוס ופילוג",
          "description": "איברים דומים, כינוס איברים, חוק הפילוג ובדיקת שקילות בין ביטויים.",
          "group": "m01",
          "icon": "branch",
          "noamTopicId": "G7-T29",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "9f3745e1127746d685375613afb9f939",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "b72143228069490e8498b2efb18ead73",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "b129faaffa3a4d76a6446191a7622b14",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G7-T29",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "9f3745e1127746d685375613afb9f939",
              "pb": "b72143228069490e8498b2efb18ead73",
              "pc": "b129faaffa3a4d76a6446191a7622b14"
            }
          }
        },
        {
          "id": 20,
          "title": "תיבה וקובייה",
          "description": "מבנה התיבה והקובייה, פריסה, שטח פנים, נפח ויחידות מידה.",
          "group": "m01",
          "icon": "cube",
          "noamTopicId": "G7-T20",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "b7a39ec55b5c4d0faab07eb813c275ea",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "5fe8d7068852467aa1d33687fa04d391",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "cef52ae5cbb84b5eaf3acd1b9b7f5a37",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G7-T20",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "b7a39ec55b5c4d0faab07eb813c275ea",
              "pb": "5fe8d7068852467aa1d33687fa04d391",
              "pc": "cef52ae5cbb84b5eaf3acd1b9b7f5a37"
            }
          }
        },
        {
          "id": 24,
          "title": "איסוף וקריאת מידע",
          "description": "איסוף נתונים, ארגון בטבלה, קריאת דיאגרמות והסקת מסקנות.",
          "group": "m01",
          "icon": "table",
          "noamTopicId": "G7-T24",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "b9533357a17649659afa70ad69caeb8e",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "da3a3af7e9ed4aaeb5835da34a72dfab",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "f2aa3600709649b887dd5c480d78e780",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G7-T24",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "b9533357a17649659afa70ad69caeb8e",
              "pb": "da3a3af7e9ed4aaeb5835da34a72dfab",
              "pc": "f2aa3600709649b887dd5c480d78e780"
            }
          }
        },
        {
          "id": 25,
          "title": "שכיחות",
          "description": "טבלת שכיחות, השכיח, קריאת נתונים והצגתם בדיאגרמה.",
          "group": "m02",
          "icon": "tally",
          "noamTopicId": "G7-T25",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "b700234f94294cd0818ab1114e6cf268",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "603ae3022235401285aef9c415ec56b3",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "739a20263fb246f0b70d23a1972b9859",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G7-T25",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "b700234f94294cd0818ab1114e6cf268",
              "pb": "603ae3022235401285aef9c415ec56b3",
              "pc": "739a20263fb246f0b70d23a1972b9859"
            }
          }
        },
        {
          "id": 26,
          "title": "שכיחות יחסית חלק 1 — היכרות",
          "description": "חישוב שכיחות יחסית בשבר, בעשרוני ובאחוזים והשוואה בין קבוצות.",
          "group": "m02",
          "icon": "percent",
          "noamTopicId": "G7-T26",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "bc5616ef49fd42e1ae1b7d9840bd71d5",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "662bd4d64bbf461ea044fa2e125fec26",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "0e23e46e04054092a612f406d2f41efd",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G7-T26",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "bc5616ef49fd42e1ae1b7d9840bd71d5",
              "pb": "662bd4d64bbf461ea044fa2e125fec26",
              "pc": "0e23e46e04054092a612f406d2f41efd"
            }
          }
        },
        {
          "id": 27,
          "title": "שכיחות יחסית חלק 2 — ניסויים ויציבות",
          "description": "ניסויים חוזרים, התייצבות השכיחות היחסית והקשר להסתברות.",
          "group": "m02",
          "icon": "flask",
          "noamTopicId": "G7-T27",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "6b56a4db3e244387b12d7cf0bed3b55c",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "55d4e3af5dc9475280503de2dcbf4902",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "f07c6f55faa6446a8bde6cf01fbf3850",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G7-T27",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "6b56a4db3e244387b12d7cf0bed3b55c",
              "pb": "55d4e3af5dc9475280503de2dcbf4902",
              "pc": "f07c6f55faa6446a8bde6cf01fbf3850"
            }
          }
        },
        {
          "id": 28,
          "title": "הסתברות — היכרות",
          "description": "מרחב התוצאות, מאורע ודאי ובלתי אפשרי, חישוב הסתברות בסיסית והוגנות.",
          "group": "m02",
          "icon": "dice",
          "noamTopicId": "G7-T28",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "cecd744033ff487bbca173c75c8d9948",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "0ad55184eb594aaf83d4306744c83891",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "e2e76a38716a443a82f0bd64d0e30556",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G7-T28",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "cecd744033ff487bbca173c75c8d9948",
              "pb": "0ad55184eb594aaf83d4306744c83891",
              "pc": "e2e76a38716a443a82f0bd64d0e30556"
            }
          }
        },
        {
          "id": 30,
          "title": "שוויון ביטויים חלק 2 — גורם משותף ומינוס לפני סוגריים",
          "description": "הוצאת גורם משותף, פתיחת סוגריים אחרי מינוס ופישוט ביטויים מורכבים.",
          "group": "m02",
          "icon": "factor",
          "noamTopicId": "G7-T30",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "bf2d6009810c4f878fe4d0bd655e5ccc",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "e0052363595a4c75bf227c8de2acece6",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "9659a8e1478246a19b40dafe453ac531",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G7-T30",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "bf2d6009810c4f878fe4d0bd655e5ccc",
              "pb": "e0052363595a4c75bf227c8de2acece6",
              "pc": "9659a8e1478246a19b40dafe453ac531"
            }
          }
        },
        {
          "id": 33,
          "title": "משוואות ופתרונן חלק 1 — מבוא",
          "description": "משמעות הפתרון, כללי שקילות, העברת אגפים ובדיקת הפתרון.",
          "group": "m03",
          "icon": "scale",
          "noamTopicId": "G7-T33",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "d86763147b8744a9acc7ca6694c36ac8",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "b3598cacd7a242d494b63956008bd970",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "7223d2ca5a544f5ea79ce7ed5e6269ab",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G7-T33",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "d86763147b8744a9acc7ca6694c36ac8",
              "pb": "b3598cacd7a242d494b63956008bd970",
              "pc": "7223d2ca5a544f5ea79ce7ed5e6269ab"
            }
          }
        },
        {
          "id": 32,
          "title": "מהו פתרון של משוואה",
          "description": "משמעות הפתרון, בדיקה בהצבה, זיהוי פתרון נכון ומשוואות אמת ושקר.",
          "group": "m03",
          "icon": "scale",
          "noamTopicId": "G7-T32",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "d94c909460964143b2127be632ddf167",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "65bc6fe3c0564a31a48c1ba0583f4345",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "548d397fab67450a8b66e950ecb5dd0e",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G7-T32",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "d94c909460964143b2127be632ddf167",
              "pb": "65bc6fe3c0564a31a48c1ba0583f4345",
              "pc": "548d397fab67450a8b66e950ecb5dd0e"
            }
          }
        },
        {
          "id": 34,
          "title": "משוואות חד־שלביות",
          "description": "פתרון משוואות בפעולה אחת — חיבור, חיסור, כפל וחילוק — ובדיקת הפתרון.",
          "group": "m03",
          "icon": "arrowbox",
          "noamTopicId": "G7-T34",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "dab269f8452c4252b7eeabe920217f9e",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "d96091082589468b9d9d73a1367a3d7a",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "2a6f2841ad1d479ca7d010dd042f680d",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G7-T34",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "dab269f8452c4252b7eeabe920217f9e",
              "pb": "d96091082589468b9d9d73a1367a3d7a",
              "pc": "2a6f2841ad1d479ca7d010dd042f680d"
            }
          }
        },
        {
          "id": 35,
          "title": "משוואות דו־שלביות",
          "description": "פתרון בשני שלבים, סדר פעולות הפוך, בידוד הנעלם ובדיקת הפתרון.",
          "group": "m03",
          "icon": "steps",
          "noamTopicId": "G7-T35",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "2f7398bfabb04f7c92be573f222561f6",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "1c0d862537914450946324c8a145af04",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "5613be2eafda43008092bceb6c01e1cd",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G7-T35",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "2f7398bfabb04f7c92be573f222561f6",
              "pb": "1c0d862537914450946324c8a145af04",
              "pc": "5613be2eafda43008092bceb6c01e1cd"
            }
          }
        },
        {
          "id": 36,
          "title": "מפשטים ואז פותרים",
          "description": "כינוס איברים דומים בכל אגף, פישוט המשוואה ומעבר מסודר לפתרון.",
          "group": "m03",
          "icon": "factor",
          "noamTopicId": "G7-T36",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "a17452e723ae450db74a1f9bf479af96",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "eb78ab16801b4be1a9eb12a94bc118b9",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "0647e59a9dca4cb4ac22f791a98dea9f",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G7-T36",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "a17452e723ae450db74a1f9bf479af96",
              "pb": "eb78ab16801b4be1a9eb12a94bc118b9",
              "pc": "0647e59a9dca4cb4ac22f791a98dea9f"
            }
          }
        },
        {
          "id": 37,
          "title": "משוואות ופתרונן חלק 2 — סוגריים ושקילות",
          "description": "משוואות עם סוגריים, נעלם בשני האגפים, אין פתרון ואינסוף פתרונות.",
          "group": "m03",
          "icon": "braces",
          "noamTopicId": "G7-T37",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "12d520f189f84c5c93bf25a006adc09f",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "44e85ac092704347aa4b7515ba2b79c0",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "e31aa40d2c414d35adc41b1d2c120e4e",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G7-T37",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "12d520f189f84c5c93bf25a006adc09f",
              "pb": "44e85ac092704347aa4b7515ba2b79c0",
              "pc": "e31aa40d2c414d35adc41b1d2c120e4e"
            }
          }
        },
        {
          "id": 38,
          "title": "סוגריים וחוק הפילוג",
          "description": "פתיחת סוגריים בחוק הפילוג, מינוס לפני סוגריים ופתרון משוואות מלאות.",
          "group": "m03",
          "icon": "branch",
          "noamTopicId": "G7-T38",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "707f56abd61f4003a7503d533968569d",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "9ad5ade1577544418d1fa8d69ff527a4",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "402c1f3155ec4cbaac4add4ff11a4887",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G7-T38",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "707f56abd61f4003a7503d533968569d",
              "pb": "9ad5ade1577544418d1fa8d69ff527a4",
              "pc": "402c1f3155ec4cbaac4add4ff11a4887"
            }
          }
        },
        {
          "id": 39,
          "title": "הנעלם בשני האגפים",
          "description": "העברת נעלמים ומספרים בין אגפים, כינוס ופתרון, כולל מקרים מיוחדים.",
          "group": "m03",
          "icon": "range",
          "noamTopicId": "G7-T39",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "7a2e133c4b484319bbf74f918538cdf5",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "354004be379d4d8bbf19f62fbd24a58d",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "d74d1a63fd7a4bd59e7da3bf0fbf46aa",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G7-T39",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "7a2e133c4b484319bbf74f918538cdf5",
              "pb": "354004be379d4d8bbf19f62fbd24a58d",
              "pc": "d74d1a63fd7a4bd59e7da3bf0fbf46aa"
            }
          }
        },
        {
          "id": 40,
          "title": "שלושה ייצוגים לפתרון משוואה",
          "description": "פתרון משוואה בשלושה ייצוגים — מודל, טבלה ופעולות אלגבריות — והמעבר ביניהם.",
          "group": "m03",
          "icon": "cycle",
          "noamTopicId": "G7-T40",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "20c94d7c0cc848cfb6419dc33c28ef16",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "8bd2c48fff214a359af747207d791100",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "153a2258b3d944f8ba5e4826bc4f1a36",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G7-T40",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "20c94d7c0cc848cfb6419dc33c28ef16",
              "pb": "8bd2c48fff214a359af747207d791100",
              "pc": "153a2258b3d944f8ba5e4826bc4f1a36"
            }
          }
        },
        {
          "id": 42,
          "title": "פיתגורס חלק 1 — היכרות וחישוב",
          "description": "משפט פיתגורס, ניצבים ויתר, חישוב צלע חסרה ובדיקה אם המשולש ישר־זווית.",
          "group": "m03",
          "icon": "pythag",
          "noamTopicId": "G7-T42",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "4776eb8d58fd4a75b66820018b897e17",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "bed47a7056dc440eae02dd5d5d34673f",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "d5d8a3ba151d47ef8e9159956ecb5263",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G7-T42",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "4776eb8d58fd4a75b66820018b897e17",
              "pb": "bed47a7056dc440eae02dd5d5d34673f",
              "pc": "d5d8a3ba151d47ef8e9159956ecb5263"
            }
          }
        },
        {
          "id": 43,
          "title": "פיתגורס חלק 2 — שימושים",
          "description": "שימוש בפיתגורס במלבן, בטרפז, בגובה משולש ובבעיות מהחיים.",
          "group": "m03",
          "icon": "pythag",
          "noamTopicId": "G7-T43",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "2b1d3056caa1496b863765c957d2f942",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "bb0cc3bff3c6448b85bb56169ba5d1ef",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "5e2500ea4a014e849977fc098ea9a835",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G7-T43",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "2b1d3056caa1496b863765c957d2f942",
              "pb": "bb0cc3bff3c6448b85bb56169ba5d1ef",
              "pc": "5e2500ea4a014e849977fc098ea9a835"
            }
          }
        },
        {
          "id": 41,
          "title": "שאלות מילוליות באמצעות משוואות",
          "description": "בחירת נעלם, בניית משוואה מתוך סיפור, פתרון ובדיקת סבירות התשובה.",
          "group": "m04",
          "icon": "speech",
          "noamTopicId": "G7-T41",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "4658c078b87740e7a5d0a8abf3e88717",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "de46359e8a624fdfadaef12b31fd7198",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "c71d485429794a3babd539808721d40f",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G7-T41",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "4658c078b87740e7a5d0a8abf3e88717",
              "pb": "de46359e8a624fdfadaef12b31fd7198",
              "pc": "c71d485429794a3babd539808721d40f"
            }
          }
        },
        {
          "id": 45,
          "title": "שטחים ב׳ חלק 1 — מקבילית וטרפז",
          "description": "נוסחאות שטח מקבילית וטרפז, זיהוי הגובה ומציאת נתון חסר.",
          "group": "m04",
          "icon": "pgram",
          "noamTopicId": "G7-T45",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "e5e7f80a61704a47812ad8746c596b99",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "8970e00541ec4234bed08535fa14f392",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "30b21e08b07a45f5a2a78cc4b4d0a212",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G7-T45",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "e5e7f80a61704a47812ad8746c596b99",
              "pb": "8970e00541ec4234bed08535fa14f392",
              "pc": "30b21e08b07a45f5a2a78cc4b4d0a212"
            }
          }
        },
        {
          "id": 46,
          "title": "שטחים ב׳ חלק 2 — מצולעים מורכבים",
          "description": "פירוק לצורות מוכרות, חיסור שטחים ושאלות משולבות.",
          "group": "m04",
          "icon": "lshape",
          "noamTopicId": "G7-T46",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "33bb88e3144345578e4748286dabed97",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "67caa6e8341841f7acaaf83107e85f75",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "df5624fb425541a7ba62f7f9d0221683",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G7-T46",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "33bb88e3144345578e4748286dabed97",
              "pb": "67caa6e8341841f7acaaf83107e85f75",
              "pc": "df5624fb425541a7ba62f7f9d0221683"
            }
          }
        },
        {
          "id": 31,
          "title": "נקודות על גרף ברביע הראשון",
          "description": "סימון נקודות, מעבר בין טבלה לגרף, קריאת גרף ותיאור תהליכים.",
          "group": "m05",
          "icon": "point",
          "noamTopicId": "G7-T31",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "6e50cb8780734cfa98dc9129deb75a17",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "0804b479822e45c1a7be5721b998972b",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "ec2be9496a7d44c98e9ad618639b38d6",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G7-T31",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "6e50cb8780734cfa98dc9129deb75a17",
              "pb": "0804b479822e45c1a7be5721b998972b",
              "pc": "ec2be9496a7d44c98e9ad618639b38d6"
            }
          }
        },
        {
          "id": 44,
          "title": "חישובי היקף — צורות מורכבות ואלגברה",
          "description": "היקף מצולעים מורכבים, ביטוי היקף באמצעות משתנה והשוואת היקפים.",
          "group": "m05",
          "icon": "dashrect",
          "noamTopicId": "G7-T44",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "d6ad7e5a5f6b4eb0b6e10d318243d5df",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "fc32a25c1b6540a98347a850013d6163",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "f1615cfe97d04f13bcd9233fe93ec09b",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G7-T44",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "d6ad7e5a5f6b4eb0b6e10d318243d5df",
              "pb": "fc32a25c1b6540a98347a850013d6163",
              "pc": "f1615cfe97d04f13bcd9233fe93ec09b"
            }
          }
        },
        {
          "id": 47,
          "title": "מנסרה משולשת חלק 1 — מבנה ונפח",
          "description": "זיהוי המנסרה, בסיסים, מקצועות וגובה, חישוב נפח ומציאת נתון חסר.",
          "group": "m05",
          "icon": "prism",
          "noamTopicId": "G7-T47",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "022d08c41e3c4ca38122150f4bfe5fe6",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "6d05ee624f5a41ba9ee6ce6f95032c30",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "4457125905df478dbe3708b198d3f9ba",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G7-T47",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "022d08c41e3c4ca38122150f4bfe5fe6",
              "pb": "6d05ee624f5a41ba9ee6ce6f95032c30",
              "pc": "4457125905df478dbe3708b198d3f9ba"
            }
          }
        },
        {
          "id": 48,
          "title": "מנסרה משולשת חלק 2 — שטח פנים",
          "description": "פריסת המנסרה, שטח המעטפת, שטח הבסיסים ושטח הפנים הכולל.",
          "group": "m05",
          "icon": "prism",
          "noamTopicId": "G7-T48",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "d11b7d930869421594088bc155e2643e",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "27c5582b89174963a432a5d8c1769f9e",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "460399b05e6046adbe518d2d87c32445",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G7-T48",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "d11b7d930869421594088bc155e2643e",
              "pb": "27c5582b89174963a432a5d8c1769f9e",
              "pc": "460399b05e6046adbe518d2d87c32445"
            }
          }
        },
        {
          "id": 16,
          "title": "משולש שווה־צלעות — העמקה ורשות",
          "description": "תכונות וסימטריה, גובה ותיכון ושאלות אתגר ורשות.",
          "group": "m06",
          "icon": "star",
          "noamTopicId": "G7-T16",
          "levels": [
            {
              "key": "one",
              "label": "העמקה ורשות",
              "pdfId": "4a4af26aaede4dc3846c78f1bd7dba31",
              "labelSource": "link.oneLabel",
              "viewerLevel": "one"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G7-T16",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 49,
          "title": "חזרה שנתית",
          "description": "חזרה מסכמת על נושאי כיתה ז׳, בשלוש רמות.",
          "group": "m06",
          "icon": "clipboard",
          "noamTopicId": "G7-T49",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "86643d62d70443f6bef326fcbb673ab0",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "4714a6557ba249eb94bf23658ff2a239",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "b672d077ec764953b1863167e9711cdc",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G7-T49",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "86643d62d70443f6bef326fcbb673ab0",
              "pb": "4714a6557ba249eb94bf23658ff2a239",
              "pc": "b672d077ec764953b1863167e9711cdc"
            }
          }
        },
        {
          "id": 50,
          "title": "משימת הערכה 1",
          "description": "משימת הערכה ראשונה בכיתה ז׳, בשלוש רמות.",
          "group": "m11",
          "icon": "clipboard",
          "noamTopicId": "G7-T50",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "19e79302c61f42e69eee0ec15734dd8a",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "abd0a1873cdf4a03b9864fa5e6a74b3c",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "59358f19a4b7485db687e4e35400df86",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G7-T50",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "19e79302c61f42e69eee0ec15734dd8a",
              "pb": "abd0a1873cdf4a03b9864fa5e6a74b3c",
              "pc": "59358f19a4b7485db687e4e35400df86"
            }
          }
        }
      ]
    },
    {
      "grade": 8,
      "label": "כיתה ח׳",
      "emoji": "🧪",
      "groups": [
        {
          "key": "alg",
          "label": "אלגברה ומשוואות",
          "reducedProgram": false
        },
        {
          "key": "fun",
          "label": "פונקציות",
          "reducedProgram": false
        },
        {
          "key": "ratio",
          "label": "יחס, אחוזים וקנה מידה",
          "reducedProgram": false
        },
        {
          "key": "data",
          "label": "נתונים, סטטיסטיקה והסתברות",
          "reducedProgram": false
        },
        {
          "key": "model",
          "label": "מידול",
          "reducedProgram": false
        },
        {
          "key": "geo",
          "label": "גאומטריה",
          "reducedProgram": false
        },
        {
          "key": "solid",
          "label": "שורשים, פיתגורס וגופים",
          "reducedProgram": false
        },
        {
          "key": "synth",
          "label": "שילוב, הרחבה והערכה",
          "reducedProgram": false
        },
        {
          "key": "support",
          "label": "תמיכה ואבחון",
          "reducedProgram": false
        },
        {
          "key": "deep",
          "label": "העמקה",
          "reducedProgram": false
        }
      ],
      "topics": [
        {
          "id": 1,
          "title": "אבחון קדם־ידע",
          "description": "מיפוי ידע מכיתה ז׳ לפני תחילת השנה — מספרים מכוונים, ביטויים אלגבריים ושברים.",
          "group": "support",
          "icon": "magnify",
          "levels": [
            {
              "key": "one",
              "label": "דף יחיד — כל הרמות",
              "pdfId": "f5e5da68fc91439485d53e5f68b74f0b",
              "labelSource": "default",
              "viewerLevel": "one"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T01",
            "aiHintShown": false,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 2,
          "title": "משוואות ליניאריות",
          "description": "פתרון משוואות מדרגה ראשונה, כינוס איברים, העברת אגפים, פתיחת סוגריים ובדיקת פתרון.",
          "group": "alg",
          "icon": "scale",
          "noamTopicId": "G8-T02",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "4d77b8a6dc9a471594f248c95a7575c0",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "7d1d4f0a117d4b1ca979c62df6b50b96",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "684eedcc41e54a71823852d043a297f6",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T02",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "4d77b8a6dc9a471594f248c95a7575c0",
              "pb": "7d1d4f0a117d4b1ca979c62df6b50b96",
              "pc": "684eedcc41e54a71823852d043a297f6"
            }
          }
        },
        {
          "id": 3,
          "title": "מכנים מספריים",
          "description": "משוואות עם שברים, מכנה משותף, הכפלה בכל המשוואה ופישוט לפני פתרון.",
          "group": "alg",
          "icon": "frac",
          "noamTopicId": "G8-T03",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "1890a0b2a77a48188a9a006af51d4ea6",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "1593f8a8b8dc427eb7eb2f721ac35dfb",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "a55ad4b479834389b93955264330c498",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T03",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "1890a0b2a77a48188a9a006af51d4ea6",
              "pb": "1593f8a8b8dc427eb7eb2f721ac35dfb",
              "pc": "a55ad4b479834389b93955264330c498"
            }
          }
        },
        {
          "id": 4,
          "title": "יחס ופרופורציה",
          "description": "יחס בין גדלים, חלוקה לפי יחס, פרופורציה ישרה והפוכה ובעיות יישום.",
          "group": "ratio",
          "icon": "ratio",
          "noamTopicId": "G8-T24",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "1cd0d5ee61c44100925f8b809d6a672b",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "0e7c2da24a9943da879d191f2fff1a11",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "8a9212498afb4ba78038cbf40b70052e",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T24",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "1cd0d5ee61c44100925f8b809d6a672b",
              "pb": "0e7c2da24a9943da879d191f2fff1a11",
              "pc": "8a9212498afb4ba78038cbf40b70052e"
            }
          }
        },
        {
          "id": 5,
          "title": "קנה מידה",
          "description": "קריאת מפות ותרשימים, חישוב מרחקים ואורכים אמיתיים והשפעת קנה המידה על שטח.",
          "group": "ratio",
          "icon": "map",
          "noamTopicId": "G8-T25",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "79243d687e8c42a28d156ef6ecedfea8",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "e1e7cbc0db784a6bace0b86b742659a7",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "e7b11e96954b4935951214f8a9035814",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T25",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "79243d687e8c42a28d156ef6ecedfea8",
              "pb": "e1e7cbc0db784a6bace0b86b742659a7",
              "pc": "e7b11e96954b4935951214f8a9035814"
            }
          }
        },
        {
          "id": 6,
          "title": "אחוזים — ייצוגים",
          "description": "מעבר בין שבר פשוט, שבר עשרוני ואחוז, חישוב אחוז מכמות ואחוז שלם.",
          "group": "ratio",
          "icon": "percent",
          "noamTopicId": "G8-T20",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "2609ac86fb5045b59d5c9823a4cadbd9",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "54deb34c469f4ece9a2fa5093a877c5e",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "73d8fa5657d64c55be52820cda5c0841",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T20",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "2609ac86fb5045b59d5c9823a4cadbd9",
              "pb": "54deb34c469f4ece9a2fa5093a877c5e",
              "pc": "73d8fa5657d64c55be52820cda5c0841"
            }
          }
        },
        {
          "id": 7,
          "title": "בעיות אחוזים",
          "description": "מציאת החלק, השלם ואחוז, הנחות ותוספות, מע״מ, ריבית ובעיות מהחיים.",
          "group": "ratio",
          "icon": "tag",
          "noamTopicId": "G8-T21",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "14dfa34d5eae41cbb4858ba36e9d492f",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "cf6e578aab7c43fa951044966badb121",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "66460dc78c48472fb6dd74e287414400",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T21",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "14dfa34d5eae41cbb4858ba36e9d492f",
              "pb": "cf6e578aab7c43fa951044966badb121",
              "pc": "66460dc78c48472fb6dd74e287414400"
            }
          }
        },
        {
          "id": 8,
          "title": "שינוי באחוזים",
          "description": "עלייה וירידה באחוזים, חישוב אחוז השינוי והמעבר מערך התחלתי לערך סופי.",
          "group": "ratio",
          "icon": "updown",
          "noamTopicId": "G8-T22",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "438d52243e2c4d05818bae586f6a5f53",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "e5bdc917e16441df9503097d9be73742",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "3fc18fcf47e444f29e23d5833ebd11cf",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T22",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "438d52243e2c4d05818bae586f6a5f53",
              "pb": "e5bdc917e16441df9503097d9be73742",
              "pc": "3fc18fcf47e444f29e23d5833ebd11cf"
            }
          }
        },
        {
          "id": 9,
          "title": "שינויים עוקבים",
          "description": "שני שינויים ברצף, אחוז השינוי הכולל, ומדוע ירידה ועלייה שוות אינן מחזירות למחיר המקורי.",
          "group": "ratio",
          "icon": "steps",
          "noamTopicId": "G8-T23",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "729eda27840f40c6b44ddca8917a727b",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "7abf038ad2fb4c9189a02367f2a2f5ff",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "8cb4b14d7f3c42c5855b8d64cb1b7284",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T23",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "729eda27840f40c6b44ddca8917a727b",
              "pb": "7abf038ad2fb4c9189a02367f2a2f5ff",
              "pc": "8cb4b14d7f3c42c5855b8d64cb1b7284"
            }
          }
        },
        {
          "id": 10,
          "title": "שורש ריבועי",
          "description": "משמעות השורש, אומדן, פישוט שורשים ופעולות בסיסיות עם שורשים.",
          "group": "solid",
          "icon": "root",
          "noamTopicId": "G8-T48",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "bde6b0bb089b4687b336fc05acb9a240",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "60f35183946a43b4b718b6863df0eb9a",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "f498c239da564057983ee1c8e67dc316",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T48",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "bde6b0bb089b4687b336fc05acb9a240",
              "pb": "60f35183946a43b4b718b6863df0eb9a",
              "pc": "f498c239da564057983ee1c8e67dc316"
            }
          }
        },
        {
          "id": 11,
          "title": "פיתגורס",
          "description": "משפט פיתגורס, חישוב יתר וניצב ובדיקה אם משולש הוא ישר־זווית.",
          "group": "solid",
          "icon": "pythag",
          "noamTopicId": "G8-T49",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "7cc070c70390453ea18611721273bfaf",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "37f44dd3595348c09f949dc6f8c33870",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "c6b776aa000041d9955788bac628e765",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T49",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "7cc070c70390453ea18611721273bfaf",
              "pb": "37f44dd3595348c09f949dc6f8c33870",
              "pc": "c6b776aa000041d9955788bac628e765"
            }
          }
        },
        {
          "id": 12,
          "title": "פיתגורס מורכב",
          "description": "שילוב פיתגורס במרובעים, בגבהים ובמשולשים מורכבים ושילוב עם חישובי שטח.",
          "group": "solid",
          "icon": "pythag",
          "noamTopicId": "G8-T50",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "6dbfa3fd61df4ba9ac85b4a877daea2d",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "35a2c13891bd428dbbff0882b89957e2",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "4f20a4286850488cb34785e4e04fc2dc",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T50",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "6dbfa3fd61df4ba9ac85b4a877daea2d",
              "pb": "35a2c13891bd428dbbff0882b89957e2",
              "pc": "4f20a4286850488cb34785e4e04fc2dc"
            }
          }
        },
        {
          "id": 13,
          "title": "גליל — שטח פנים",
          "description": "פריסת הגליל, שטח המעטפת, שטח הבסיסים ושטח הפנים הכולל.",
          "group": "solid",
          "icon": "cyl",
          "noamTopicId": "G8-T52",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "9b10c4ae6e564d4692c958b7664e6d60",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "c11b65c13a1347f3b94d13afe396748e",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "0b63e6ceeed343dcbd3ac394d92c58cf",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T52",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "9b10c4ae6e564d4692c958b7664e6d60",
              "pb": "c11b65c13a1347f3b94d13afe396748e",
              "pc": "0b63e6ceeed343dcbd3ac394d92c58cf"
            }
          }
        },
        {
          "id": 14,
          "title": "גליל — נפח",
          "description": "חישוב נפח גליל, מציאת רדיוס או גובה חסרים ובעיות יישום ומיכלים.",
          "group": "solid",
          "icon": "cyl",
          "noamTopicId": "G8-T53",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "ae8dc9508f084ba0ae778e158649b1f4",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "12e74a0b5da44d0f8de960e3afa996f8",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "d58c0aeb2208488594ec4c671d8ca7bb",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T53",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "ae8dc9508f084ba0ae778e158649b1f4",
              "pb": "12e74a0b5da44d0f8de960e3afa996f8",
              "pc": "d58c0aeb2208488594ec4c671d8ca7bb"
            }
          }
        },
        {
          "id": 15,
          "title": "חרוט",
          "description": "מבנה החרוט, הבסיס המעגלי והקודקוד, שטח המעטפת ושטח הפנים, נפח החרוט והשוואה לגליל.",
          "group": "solid",
          "icon": "cyl",
          "noamTopicId": "G8-T54",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "2cb11400ca46430f80b6db81fac863b5",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "5cb2c229f1dd44babf5cbb92de74a70e",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "f246d1ff6f584f0f8023cd41a9b7099b",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T54",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "2cb11400ca46430f80b6db81fac863b5",
              "pb": "5cb2c229f1dd44babf5cbb92de74a70e",
              "pc": "f246d1ff6f584f0f8023cd41a9b7099b"
            }
          }
        },
        {
          "id": 16,
          "title": "ארגון נתונים",
          "description": "טבלאות שכיחות, קיבוץ נתונים לקבוצות, שכיחות יחסית וקריאת טבלאות.",
          "group": "data",
          "icon": "table",
          "noamTopicId": "G8-T28",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "02042ce4c2d94a7db1af3f4e60ee3bcb",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "72ff207d5b264051b8a8a779915c4bae",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "0ead0b90367f4936ab430938c48dda7c",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T28",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "02042ce4c2d94a7db1af3f4e60ee3bcb",
              "pb": "72ff207d5b264051b8a8a779915c4bae",
              "pc": "0ead0b90367f4936ab430938c48dda7c"
            }
          }
        },
        {
          "id": 17,
          "title": "עמודות ופיקטוגרמות",
          "description": "בניית דיאגרמת עמודות ופיקטוגרמה, קריאתן והשוואה בין קבוצות נתונים.",
          "group": "data",
          "icon": "bars",
          "noamTopicId": "G8-T29",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "34fc04b2cbaa43d1ab142bf0a7f3eb3b",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "aefafd7e6c66437b98c50c44acd52c0e",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "c022a2bd74204ba9a15c0923b44cb71a",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T29",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "34fc04b2cbaa43d1ab142bf0a7f3eb3b",
              "pb": "aefafd7e6c66437b98c50c44acd52c0e",
              "pc": "c022a2bd74204ba9a15c0923b44cb71a"
            }
          }
        },
        {
          "id": 18,
          "title": "דיאגרמת עוגה",
          "description": "חישוב זוויות המגזרים ואחוזים, בניית עוגה מתוך טבלה וקריאת נתונים ממנה.",
          "group": "data",
          "icon": "pie",
          "noamTopicId": "G8-T30",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "72edbfe254b74cbcbd08856b3ebaf804",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "51fa9bbf02904cdab1e016161aeeb7cb",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "92cfe6cb439a4c03a30aa700c73dad68",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T30",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "72edbfe254b74cbcbd08856b3ebaf804",
              "pb": "51fa9bbf02904cdab1e016161aeeb7cb",
              "pc": "92cfe6cb439a4c03a30aa700c73dad68"
            }
          }
        },
        {
          "id": 19,
          "title": "מושג הפונקציה",
          "description": "משתנה תלוי ובלתי תלוי, התאמה חד־ערכית, זיהוי פונקציה ושאינה פונקציה.",
          "group": "fun",
          "icon": "machine",
          "noamTopicId": "G8-T11",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "c1091e09fd704208b64787ae52916950",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "baa03272b80f4ec0b428156dd41d337d",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "45e83202136044d3871b45eefca0a8fb",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T11",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "c1091e09fd704208b64787ae52916950",
              "pb": "baa03272b80f4ec0b428156dd41d337d",
              "pc": "45e83202136044d3871b45eefca0a8fb"
            }
          }
        },
        {
          "id": 20,
          "title": "סימון פונקציה",
          "description": "הסימון f(x), חישוב ערך הפונקציה, מציאת מקור לפי תמונה וקריאת ערכים מגרף.",
          "group": "fun",
          "icon": "braces",
          "noamTopicId": "G8-T16",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "e1b7865746774b6a9a8293985626c15d",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "8bea76e18dac4e2094313407e207141f",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "57a8838fe82a4bad8efddd3053027d9e",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T16",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "e1b7865746774b6a9a8293985626c15d",
              "pb": "8bea76e18dac4e2094313407e207141f",
              "pc": "57a8838fe82a4bad8efddd3053027d9e"
            }
          }
        },
        {
          "id": 21,
          "title": "מעבר בין ייצוגים",
          "description": "תיאור מילולי, טבלה, גרף ונוסחה — מעבר בין ארבעת הייצוגים והתאמה ביניהם.",
          "group": "fun",
          "icon": "cycle",
          "noamTopicId": "G8-T12",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "b07b6f5dc63a4f4395030b528d6a5ccc",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "bbd39bae542e4398bf25a1ed1349dbaa",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "d7421f7457b54d19981e88558c6e1d8f",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T12",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "b07b6f5dc63a4f4395030b528d6a5ccc",
              "pb": "bbd39bae542e4398bf25a1ed1349dbaa",
              "pc": "d7421f7457b54d19981e88558c6e1d8f"
            }
          }
        },
        {
          "id": 22,
          "title": "טווח הנתונים",
          "description": "חישוב הטווח, זיהוי ערכים קיצוניים ומשמעות הפיזור בהשוואה בין קבוצות.",
          "group": "data",
          "icon": "range",
          "noamTopicId": "G8-T31",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "cf6aa8801cc240c3992d180a54189419",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "4237674f01274cbbaf7a3da6669ce9fe",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "eeb2abc7a2074cd1901c2c800cd305bb",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T31",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "cf6aa8801cc240c3992d180a54189419",
              "pb": "4237674f01274cbbaf7a3da6669ce9fe",
              "pc": "eeb2abc7a2074cd1901c2c800cd305bb"
            }
          }
        },
        {
          "id": 23,
          "title": "הממוצע",
          "description": "חישוב ממוצע, ממוצע משוקלל, מציאת נתון חסר והשפעת שינוי נתון על הממוצע.",
          "group": "data",
          "icon": "avg",
          "noamTopicId": "G8-T32",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "ab9f9a9beeae48a080936b7a305c2928",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "ee29bd2442634da0961245f24b7c0f9b",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "4732bc82d5cb4976b0413b8ac1524595",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T32",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "ab9f9a9beeae48a080936b7a305c2928",
              "pb": "ee29bd2442634da0961245f24b7c0f9b",
              "pc": "4732bc82d5cb4976b0413b8ac1524595"
            }
          }
        },
        {
          "id": 24,
          "title": "החציון",
          "description": "מציאת החציון במספר זוגי ואי־זוגי של נתונים והשוואה בינו לבין הממוצע.",
          "group": "data",
          "icon": "median",
          "noamTopicId": "G8-T33",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "444185957347402095a9166d7822f136",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "befa0c8563234c71a2b22206a64ec8fd",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "d657709fb27e4bc891e17d2d510c3d7f",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T33",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "444185957347402095a9166d7822f136",
              "pb": "befa0c8563234c71a2b22206a64ec8fd",
              "pc": "d657709fb27e4bc891e17d2d510c3d7f"
            }
          }
        },
        {
          "id": 25,
          "title": "בחירת מדד",
          "description": "מתי מתאים ממוצע, מתי חציון ומתי שכיח — נימוק הבחירה לפי סוג הנתונים.",
          "group": "data",
          "icon": "checklist",
          "noamTopicId": "G8-T34",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "c86ee284bbf848bc8b742c656cd058dd",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "3d9c5be33ca84b86b253f10ac08c2327",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "a7c9ee501e8e4b9fb90efd59db5bac3c",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T34",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "c86ee284bbf848bc8b742c656cd058dd",
              "pb": "3d9c5be33ca84b86b253f10ac08c2327",
              "pc": "a7c9ee501e8e4b9fb90efd59db5bac3c"
            }
          }
        },
        {
          "id": 26,
          "title": "אוריינות וביקורת ייצוג",
          "description": "קריאה ביקורתית של גרפים וטבלאות, זיהוי ייצוגים מטעים וניסוח מסקנות מבוססות.",
          "group": "synth",
          "icon": "magnify",
          "levels": [
            {
              "key": "one",
              "label": "דף יחיד — כל הרמות",
              "pdfId": "2cf9913986224e839512320e23c74c82",
              "labelSource": "default",
              "viewerLevel": "one"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T35",
            "aiHintShown": false,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 27,
          "title": "קצב השתנות",
          "description": "שינוי קבוע מול משתנה, חישוב קצב מתוך טבלה ומתוך גרף ומשמעותו בהקשר.",
          "group": "fun",
          "icon": "steps",
          "noamTopicId": "G8-T13",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "0975cb34d4884dc384df400dd804b846",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "93be3da0abc94f6dbc606aa837e1aab2",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "c000c5af666b47758a8e83b792dc1c0d",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T13",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "0975cb34d4884dc384df400dd804b846",
              "pb": "93be3da0abc94f6dbc606aa837e1aab2",
              "pc": "c000c5af666b47758a8e83b792dc1c0d"
            }
          }
        },
        {
          "id": 28,
          "title": "שיפוע וישר y=mx",
          "description": "משמעות השיפוע, ישר העובר בראשית הצירים, שיפוע חיובי ושלילי ופרופורציה ישרה.",
          "group": "fun",
          "icon": "slope",
          "noamTopicId": "G8-T14",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "b646f348c297460ca440f4f84c880aa8",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "82bdf30b0a4d4e2f9fb57b80ed22f26f",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "9a1159da9cfa425795c48947f91d805a",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T14",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "b646f348c297460ca440f4f84c880aa8",
              "pb": "82bdf30b0a4d4e2f9fb57b80ed22f26f",
              "pc": "9a1159da9cfa425795c48947f91d805a"
            }
          }
        },
        {
          "id": 29,
          "title": "פונקציה קווית",
          "description": "הישר y=mx+n, השפעת m ושל n על הגרף, שרטוט לפי טבלה והתאמת גרף לנוסחה.",
          "group": "fun",
          "icon": "linear",
          "noamTopicId": "G8-T15",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "f693012a04194166b37dd6127b4f345c",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "fbdd83babe6843ec8ac6103564c8e81b",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "b53f2b1d1ee94a46ac8d3c175aca36c6",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T15",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "f693012a04194166b37dd6127b4f345c",
              "pb": "fbdd83babe6843ec8ac6103564c8e81b",
              "pc": "b53f2b1d1ee94a46ac8d3c175aca36c6"
            }
          }
        },
        {
          "id": 30,
          "title": "חיתוך צירים",
          "description": "נקודות חיתוך עם ציר x ועם ציר y, תחומי חיוביות ושליליות ותחומי עלייה וירידה.",
          "group": "fun",
          "icon": "dots2",
          "noamTopicId": "G8-T17",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "b740b58f64cd4f42bfb326121421d4bf",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "3c7379ea9ff84bdd81be78dfb86e1ff3",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "a27fc25991a040b3a837ed2654639cbe",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T17",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "b740b58f64cd4f42bfb326121421d4bf",
              "pb": "3c7379ea9ff84bdd81be78dfb86e1ff3",
              "pc": "a27fc25991a040b3a837ed2654639cbe"
            }
          }
        },
        {
          "id": 31,
          "title": "משוואת ישר",
          "description": "מציאת משוואת ישר לפי שתי נקודות או לפי נקודה ושיפוע, ובדיקת שייכות נקודה לישר.",
          "group": "fun",
          "icon": "ruler",
          "noamTopicId": "G8-T18",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "25346c95494e46c795762ff4ca5813c9",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "e42b5fa2c8d44a0bb5a585f4debfe425",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "19ac66cf7499433693310f589f18d3b7",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T18",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "25346c95494e46c795762ff4ca5813c9",
              "pb": "e42b5fa2c8d44a0bb5a585f4debfe425",
              "pc": "19ac66cf7499433693310f589f18d3b7"
            }
          }
        },
        {
          "id": 32,
          "title": "ישרים מקבילים לצירים",
          "description": "הישרים y=k ו-x=k, זיהוי משוואתם מהגרף ושילובם עם ישרים אחרים.",
          "group": "fun",
          "icon": "gridlines",
          "noamTopicId": "G8-T19",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "6d10415db80f47a7a1217865a8ac0b3c",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "8bd67260b5584855a92d836426f843dc",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "b57712d1f0cc47d1ad85c57d2ecdb384",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T19",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "6d10415db80f47a7a1217865a8ac0b3c",
              "pb": "8bd67260b5584855a92d836426f843dc",
              "pc": "b57712d1f0cc47d1ad85c57d2ecdb384"
            }
          }
        },
        {
          "id": 33,
          "title": "תנועה",
          "description": "בעיות מרחק, מהירות וזמן — תנועה באותו כיוון, בכיוונים מנוגדים ומפגש.",
          "group": "model",
          "icon": "arrowr",
          "noamTopicId": "G8-T10",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "240e343ffc734a7b9ee5125fa0f9253e",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "9315a3ca69b347f89fd2588efad6ac4c",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "252d99e8b51d45e58a42714dd0e90fd4",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T10",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "240e343ffc734a7b9ee5125fa0f9253e",
              "pb": "9315a3ca69b347f89fd2588efad6ac4c",
              "pc": "252d99e8b51d45e58a42714dd0e90fd4"
            }
          }
        },
        {
          "id": 34,
          "title": "אבחון אמצע שנה",
          "description": "בדיקת שליטה בנושאי המחצית הראשונה וזיהוי נקודות לחיזוק.",
          "group": "support",
          "icon": "magnify",
          "levels": [
            {
              "key": "one",
              "label": "דף יחיד — כל הרמות",
              "pdfId": "6ed4ad1901ed4c89a2b7bb40247300ce",
              "labelSource": "default",
              "viewerLevel": "one"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T26",
            "aiHintShown": false,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 35,
          "title": "גישור ותיקון פערים",
          "description": "תרגול ממוקד לסגירת פערים בסיסיים לקראת המשך הנושאים.",
          "group": "support",
          "icon": "bridge",
          "levels": [
            {
              "key": "one",
              "label": "דף יחיד — כל הרמות",
              "pdfId": "5ff9bbaff1b9498b98aa660692de2635",
              "labelSource": "default",
              "viewerLevel": "one"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T27",
            "aiHintShown": false,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 36,
          "title": "חפיפת משולשים",
          "description": "מושג החפיפה, התאמת קודקודים, צלעות וזוויות וזיהוי משולשים חופפים.",
          "group": "geo",
          "icon": "twotri",
          "noamTopicId": "G8-T38",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "790bb79fa0e140469d97e14635f9de7c",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "b26d49817e034ce0a07a79c2e28bbdd5",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "65970eb92a8d4ee28b441416fa12e1ab",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T38",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "790bb79fa0e140469d97e14635f9de7c",
              "pb": "b26d49817e034ce0a07a79c2e28bbdd5",
              "pc": "65970eb92a8d4ee28b441416fa12e1ab"
            }
          }
        },
        {
          "id": 37,
          "title": "משפטי חפיפה",
          "description": "צ.ז.צ, ז.צ.ז, צ.צ.צ — בחירת המשפט המתאים ויישומו על סרטוט נתון.",
          "group": "geo",
          "icon": "twotri",
          "noamTopicId": "G8-T39",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "cd3cfcc70f6c44eca4079c8d2bb6656a",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "bfe91ef3c877443b882890a261763a80",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "eee73c14d4f54eb7be9ca88a003231c3",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T39",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "cd3cfcc70f6c44eca4079c8d2bb6656a",
              "pb": "bfe91ef3c877443b882890a261763a80",
              "pc": "eee73c14d4f54eb7be9ca88a003231c3"
            }
          }
        },
        {
          "id": 38,
          "title": "הוכחה גאומטרית",
          "description": "מבנה ההוכחה: נתון, צריך להוכיח, טענות ונימוקים וסדר לוגי נכון.",
          "group": "geo",
          "icon": "clipcheck",
          "noamTopicId": "G8-T40",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "7bc43eb6b4614db5ad88e02e6754dbcc",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "753b902248c04c0588aa93c3ed2d2961",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "c2c6c2aab67847b78d62ebe6886322aa",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T40",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "7bc43eb6b4614db5ad88e02e6754dbcc",
              "pb": "753b902248c04c0588aa93c3ed2d2961",
              "pc": "c2c6c2aab67847b78d62ebe6886322aa"
            }
          }
        },
        {
          "id": 65,
          "title": "הוכחות בחפיפת משולשים",
          "description": "דף מסכם: בחירת משפט החפיפה המתאים, איתור נתונים נסתרים וכתיבת הוכחה מלאה עם טענה ונימוק לכל שלב.",
          "group": "geo",
          "icon": "clipcheck",
          "noamTopicId": "G8-T65",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "fc62c3516b5c4f4c8e3f433792c84c40",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "993467c2757a4950abd2a0237f18a48c",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "1626318ee2c94f6a9b53ffcaf289ec83",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T65",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "fc62c3516b5c4f4c8e3f433792c84c40",
              "pb": "993467c2757a4950abd2a0237f18a48c",
              "pc": "1626318ee2c94f6a9b53ffcaf289ec83"
            }
          }
        },
        {
          "id": 39,
          "title": "זווית חיצונית",
          "description": "משפט הזווית החיצונית, סכום זוויות במשולש ויישומים בחישוב זוויות.",
          "group": "geo",
          "icon": "angle",
          "noamTopicId": "G8-T41",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "f6ab92c5999d4d00bc1704f4aa90257a",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "acca66d18cdd4a66b48272218673c7b9",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "75fc6a4c5cab4610b39a708eef7909a5",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T41",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "f6ab92c5999d4d00bc1704f4aa90257a",
              "pb": "acca66d18cdd4a66b48272218673c7b9",
              "pc": "75fc6a4c5cab4610b39a708eef7909a5"
            }
          }
        },
        {
          "id": 40,
          "title": "משולש שווה־שוקיים",
          "description": "ישרים מקבילים וזוויות, תכונות משולש שווה-שוקיים, זוויות בסיס, חוצה זווית ושאלות הוכחה.",
          "group": "geo",
          "icon": "tritick",
          "noamTopicId": "G8-T42",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "1987889ac504482e8572217411566311",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "2a5a7daef4b14ca88d8db7fde3983a73",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "fe16c964d2a64956817e3193791a757d",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T42",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "1987889ac504482e8572217411566311",
              "pb": "2a5a7daef4b14ca88d8db7fde3983a73",
              "pc": "fe16c964d2a64956817e3193791a757d"
            }
          }
        },
        {
          "id": 41,
          "title": "הוכחה — שווה־שוקיים",
          "description": "המשפט והמשפט ההפוך, שימוש בחפיפה להוכחת שוויון שוקיים ושאלות הוכחה מורכבות.",
          "group": "geo",
          "icon": "clipcheck",
          "noamTopicId": "G8-T43",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "e67e7e378ebd44af9750988b85d1295e",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "29a9576b0bae44c3b6e15958af20220f",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "0374254c346d4fb5b1d38227cc5c0c0b",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T43",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "e67e7e378ebd44af9750988b85d1295e",
              "pb": "29a9576b0bae44c3b6e15958af20220f",
              "pc": "0374254c346d4fb5b1d38227cc5c0c0b"
            }
          }
        },
        {
          "id": 42,
          "title": "התיכון במשולש",
          "description": "תיכון לצלע ותכונותיו, התיכון ליתר במשולש ישר־זווית ושימוש בו בהוכחות.",
          "group": "geo",
          "icon": "medtri",
          "noamTopicId": "G8-T44",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "d86464b69435428dbd1666876f284fd1",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "a12b638b79a04d9785c8c5994760c960",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "44957ab2f8fd45279dd5b82244ebffe2",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T44",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "d86464b69435428dbd1666876f284fd1",
              "pb": "a12b638b79a04d9785c8c5994760c960",
              "pc": "44957ab2f8fd45279dd5b82244ebffe2"
            }
          }
        },
        {
          "id": 43,
          "title": "דמיון משולשים",
          "description": "יחס דמיון, התאמת צלעות וזוויות, חישוב אורכים חסרים וקנה מידה.",
          "group": "geo",
          "icon": "twotri2",
          "noamTopicId": "G8-T45",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "6b881f71dde74793a25ae8568c8aeeb2",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "b8da6c15d9724ac590f04d2d565a1d7a",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "df3fc7664cf64f4590cf5c5aa5482290",
              "labelSource": "default"
            },
            {
              "key": "c2",
              "label": "מצוינות 2",
              "pdfId": "e4da722565a942e482c9e4dbf6ee41b5",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T45",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "6b881f71dde74793a25ae8568c8aeeb2",
              "pb": "b8da6c15d9724ac590f04d2d565a1d7a",
              "pc": "df3fc7664cf64f4590cf5c5aa5482290",
              "pc2": "e4da722565a942e482c9e4dbf6ee41b5"
            }
          }
        },
        {
          "id": 44,
          "title": "הוכחת דמיון",
          "description": "משפטי הדמיון, כתיבת הוכחה מלאה והסקת שוויון יחסים בין צלעות.",
          "group": "geo",
          "icon": "twotri2",
          "noamTopicId": "G8-T46",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "cbd2cc183746417d85eb5e67e0af41a9",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "1cdf353258ad4ce0ba0096f31286fef5",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "3b5551fa71224d5796a2136466153d44",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T46",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "cbd2cc183746417d85eb5e67e0af41a9",
              "pb": "1cdf353258ad4ce0ba0096f31286fef5",
              "pc": "3b5551fa71224d5796a2136466153d44"
            }
          }
        },
        {
          "id": 45,
          "title": "יחס שטחים",
          "description": "יחס ההיקפים ויחס השטחים במשולשים דומים ובעיות יישום.",
          "group": "geo",
          "icon": "sq2",
          "noamTopicId": "G8-T47",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "707297858b4842d09b69d455f5eac846",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "0da9007ec11b46e1a600689e8e91d880",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "af83bcf8e5dd4f349651356079af0a62",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T47",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "707297858b4842d09b69d455f5eac846",
              "pb": "0da9007ec11b46e1a600689e8e91d880",
              "pc": "af83bcf8e5dd4f349651356079af0a62"
            }
          }
        },
        {
          "id": 46,
          "title": "מילוליות — בחירת נעלמים",
          "description": "בחירת נעלם מתאים, בניית משוואה מתוך סיפור, פתרון ופירוש התשובה בהקשר.",
          "group": "model",
          "icon": "speech",
          "noamTopicId": "G8-T09",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "c1a708894e8148d88391ac250443ee25",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "d77bea9c04b64d7a8e5f24776145ca0f",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "556fbc4ef1c6405ab8b7b77486048434",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T09",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "c1a708894e8148d88391ac250443ee25",
              "pb": "d77bea9c04b64d7a8e5f24776145ca0f",
              "pc": "556fbc4ef1c6405ab8b7b77486048434"
            }
          }
        },
        {
          "id": 47,
          "title": "מערכות — חיתוך גרפי",
          "description": "פתרון מערכת שתי משוואות בעזרת שרטוט ונקודת חיתוך, מקרים של אין פתרון ואינסוף פתרונות.",
          "group": "alg",
          "icon": "cross2",
          "noamTopicId": "G8-T06",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "1c2ce5c6f73e411196155b4df5d58c8d",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "9be17796d94c40b5bbb987c4b7ef0882",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "704e6a4ddd6b43b7a7b21e18b5b60125",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T06",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "1c2ce5c6f73e411196155b4df5d58c8d",
              "pb": "9be17796d94c40b5bbb987c4b7ef0882",
              "pc": "704e6a4ddd6b43b7a7b21e18b5b60125"
            }
          }
        },
        {
          "id": 48,
          "title": "מערכות — פתרון אלגברי",
          "description": "שיטת ההצבה ושיטת החיבור והחיסור, בחירת השיטה היעילה ובדיקת הפתרון.",
          "group": "alg",
          "icon": "syseq",
          "noamTopicId": "G8-T07",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "1ef724d40dbc4df9a54379c375a552d0",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "996d8f603bbe492b9c08841b46f1bd3e",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "ccf868d3e4a14c67940d8a0391c56979",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T07",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "1ef724d40dbc4df9a54379c375a552d0",
              "pb": "996d8f603bbe492b9c08841b46f1bd3e",
              "pc": "ccf868d3e4a14c67940d8a0391c56979"
            }
          }
        },
        {
          "id": 49,
          "title": "מערכות — מידול",
          "description": "תרגום בעיות מילוליות למערכת שתי משוואות בשני נעלמים ופירוש הפתרון בהקשר הבעיה.",
          "group": "alg",
          "icon": "speech",
          "noamTopicId": "G8-T08",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "863ebe2f492444358f2c9de7562084b2",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "1c552950aa7043ff8c3f108798173c46",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "70d353417c37451f8742b12fa3502850",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T08",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "863ebe2f492444358f2c9de7562084b2",
              "pb": "1c552950aa7043ff8c3f108798173c46",
              "pc": "70d353417c37451f8742b12fa3502850"
            }
          }
        },
        {
          "id": 50,
          "title": "הסתברות — מרחב תוצאות",
          "description": "מרחב מדגם, מאורע, ספירת תוצאות והסתברות במרחב אחיד.",
          "group": "data",
          "icon": "dice",
          "noamTopicId": "G8-T36",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "956b50af2c0c4eab94ccdf0e9332dfde",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "8ca8ae2f928e40f09c0d1f2d8a13171c",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "88bd42f4b0554b10bc2970fde4ff113f",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T36",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "956b50af2c0c4eab94ccdf0e9332dfde",
              "pb": "8ca8ae2f928e40f09c0d1f2d8a13171c",
              "pc": "88bd42f4b0554b10bc2970fde4ff113f"
            }
          }
        },
        {
          "id": 51,
          "title": "הסתברות — ניסוי והוגנות",
          "description": "שכיחות יחסית מול הסתברות תאורטית, ניסויים חוזרים ובדיקת הוגנות של משחק.",
          "group": "data",
          "icon": "flask",
          "noamTopicId": "G8-T37",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "84038e7df38c4f8c870680046366059e",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "60707df0a053404fba27bc66cc87432c",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "e59dd0e62b5043bf83de17f3a7b3dd7f",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T37",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "84038e7df38c4f8c870680046366059e",
              "pb": "60707df0a053404fba27bc66cc87432c",
              "pc": "e59dd0e62b5043bf83de17f3a7b3dd7f"
            }
          }
        },
        {
          "id": 52,
          "title": "אי־שוויון",
          "description": "פתרון אי־שוויונות, היפוך סימן בכפל ובחילוק בשלילי וייצוג הפתרון על ציר המספרים.",
          "group": "alg",
          "icon": "lt",
          "noamTopicId": "G8-T04",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "3d8a3b472b8d407dbf62a3a6353429b3",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "5f0c31dac46445809e2bf7e85e938eab",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "2a39cae9e3374b94bbb3d980bb3c5752",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T04",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "3d8a3b472b8d407dbf62a3a6353429b3",
              "pb": "5f0c31dac46445809e2bf7e85e938eab",
              "pc": "2a39cae9e3374b94bbb3d980bb3c5752"
            }
          }
        },
        {
          "id": 53,
          "title": "אי־שוויון גרפי",
          "description": "קריאת פתרון אי־שוויון מתוך גרף, השוואה בין שני ישרים וסימון תחומי הפתרון.",
          "group": "alg",
          "icon": "cross2",
          "noamTopicId": "G8-T05",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "4409b9a48eea47d48956ae7fd65cd27a",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "c4255df370d54f40b9d2e8caaf5cf471",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "ddd05eed197c407cbc24cd6b1c232ffe",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T05",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "4409b9a48eea47d48956ae7fd65cd27a",
              "pb": "c4255df370d54f40b9d2e8caaf5cf471",
              "pc": "ddd05eed197c407cbc24cd6b1c232ffe"
            }
          }
        },
        {
          "id": 54,
          "title": "פיתגורס במרחב",
          "description": "אלכסון תיבה, גובה בגופים ומרחקים במרחב בעזרת שימוש כפול בפיתגורס.",
          "group": "solid",
          "icon": "cube",
          "noamTopicId": "G8-T51",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "382b26543b294fd3b81c67b7f1d55a51",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "d282cb88e31345d5aa45093ce91a28e2",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "6b9490d9507a43359c06e8d4f1ad9946",
              "labelSource": "default"
            },
            {
              "key": "c2",
              "label": "מצוינות 2",
              "pdfId": "0b79f523d8ea4598a85d5320d6acd823",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T51",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "382b26543b294fd3b81c67b7f1d55a51",
              "pb": "d282cb88e31345d5aa45093ce91a28e2",
              "pc": "6b9490d9507a43359c06e8d4f1ad9946",
              "pc2": "0b79f523d8ea4598a85d5320d6acd823"
            }
          }
        },
        {
          "id": 55,
          "title": "שילוב גאומטרי",
          "description": "שאלות המשלבות חפיפה, דמיון, פיתגורס וחישובי שטח בסרטוט אחד.",
          "group": "synth",
          "icon": "triangle",
          "noamTopicId": "G8-T55",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "126561772f7a4eaf8389befee74088bf",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "a4bfca6ec5f74e638595ba8964e92354",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "192b46267db245da9bf1c7931860313a",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T55",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "126561772f7a4eaf8389befee74088bf",
              "pb": "a4bfca6ec5f74e638595ba8964e92354",
              "pc": "192b46267db245da9bf1c7931860313a"
            }
          }
        },
        {
          "id": 56,
          "title": "העמקה — בעיות לא שגרתיות",
          "description": "בעיות חשיבה, אסטרטגיות פתרון, ספירה חכמה ושאלות אתגר.",
          "group": "deep",
          "icon": "bulb",
          "noamTopicId": "G8-T56",
          "levels": [
            {
              "key": "one",
              "label": "העמקה",
              "pdfId": "45591aa6e5c74e48a5fdf2d074a146d7",
              "labelSource": "link.oneLabel",
              "viewerLevel": "one"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T56",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 57,
          "title": "העמקה — חקר והכללה",
          "description": "חקר תבניות מספריות וגאומטריות, ניסוח השערה, בדיקה והכללה מנומקת.",
          "group": "deep",
          "icon": "flask",
          "noamTopicId": "G8-T57",
          "levels": [
            {
              "key": "one",
              "label": "העמקה",
              "pdfId": "3bcf34a736ec4d61a5fb72948b4a1f76",
              "labelSource": "link.oneLabel",
              "viewerLevel": "one"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T57",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 58,
          "title": "חזרה מסכמת",
          "description": "חזרה רוחבית על כל פרקי השנה עם שאלות משולבות מכל התחומים.",
          "group": "synth",
          "icon": "book",
          "noamTopicId": "G8-T58",
          "levels": [
            {
              "key": "one",
              "label": "דף תלמיד",
              "pdfId": "a96a0a1a7e254c8480111c057b804f70",
              "labelSource": "link.oneLabel",
              "viewerLevel": "one"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T58",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 59,
          "title": "הערכה מסכמת",
          "description": "מבחן מסכם המשלב את נושאי השנה — אלגברה, פונקציות, נתונים וגאומטריה.",
          "group": "synth",
          "icon": "clipboard",
          "noamTopicId": "G8-T59",
          "levels": [
            {
              "key": "one",
              "label": "דף תלמיד",
              "pdfId": "0d7ce70392bb4fdcbafdea71295c6b87",
              "labelSource": "link.oneLabel",
              "viewerLevel": "one"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T59",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 60,
          "title": "אבחון סוף שנה",
          "description": "מיפוי מסכם של הידע לקראת המעבר לכיתה ט׳.",
          "group": "support",
          "icon": "magnify",
          "noamTopicId": "G8-T60",
          "levels": [
            {
              "key": "one",
              "label": "דף תלמיד",
              "pdfId": "813697a12f5f4f25861be4b4ecd7df76",
              "labelSource": "link.oneLabel",
              "viewerLevel": "one"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T60",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {}
          }
        },
        {
          "id": 61,
          "title": "אינטרפולציה ואקסטרפולציה",
          "description": "דף עבודה בשלוש רמות — לפי פריסת ההוראה תשפ״ז.",
          "group": "data",
          "icon": "star",
          "noamTopicId": "G8-T61",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "01976c29e6714eaea22cfe98318d7261",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "c43f7b014ac94d01949a59ccce44d7d1",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "9b6d6f5976324bd79ccfaaf0ddd8fff3",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T61",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "01976c29e6714eaea22cfe98318d7261",
              "pb": "c43f7b014ac94d01949a59ccce44d7d1",
              "pc": "9b6d6f5976324bd79ccfaaf0ddd8fff3"
            }
          }
        },
        {
          "id": 62,
          "title": "זוויות בין ישרים מקבילים",
          "description": "דף עבודה בשלוש רמות — לפי פריסת ההוראה תשפ״ז.",
          "group": "geo",
          "icon": "star",
          "noamTopicId": "G8-T62",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "551f5fac11ba48eb9380625da3114218",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "b6f44a30fc4b4090999c2fb74dbc6d3b",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "50a26e70686441ddb056a5a3a17d99ce",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T62",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "551f5fac11ba48eb9380625da3114218",
              "pb": "b6f44a30fc4b4090999c2fb74dbc6d3b",
              "pc": "50a26e70686441ddb056a5a3a17d99ce"
            }
          }
        },
        {
          "id": 63,
          "title": "מעגל ועיגול — היקף ושטח",
          "description": "דף עבודה בשלוש רמות — לפי פריסת ההוראה תשפ״ז.",
          "group": "solid",
          "icon": "star",
          "noamTopicId": "G8-T63",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "0436b984908b4ca8bdcd12157c512f3a",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "71af6f83a413405f8be85802a15b10a8",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "93d3eea6dab54bc8a1e345d4f2bb3b6b",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T63",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "0436b984908b4ca8bdcd12157c512f3a",
              "pb": "71af6f83a413405f8be85802a15b10a8",
              "pc": "93d3eea6dab54bc8a1e345d4f2bb3b6b"
            }
          }
        },
        {
          "id": 64,
          "title": "משימת הערכה 1",
          "description": "דף עבודה בשלוש רמות — לפי פריסת ההוראה תשפ״ז.",
          "group": "synth",
          "icon": "star",
          "noamTopicId": "G8-T64",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "a3d4cf8e50ee4b2ebe84504f5bf41adb",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "d8c797015d914370b0aa2de763d66192",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "497fa6cea0d54988a9357357ef0b90ab",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T64",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "a3d4cf8e50ee4b2ebe84504f5bf41adb",
              "pb": "d8c797015d914370b0aa2de763d66192",
              "pc": "497fa6cea0d54988a9357357ef0b90ab"
            }
          }
        },
        {
          "id": 66,
          "title": "שני מקורות מידע",
          "description": "השוואה ושילוב של נתונים משני מקורות מידע.",
          "group": "data",
          "icon": "table",
          "noamTopicId": "G8-T66",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "2c1a359db25f4dafa192a64440248088",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "27cce5e7983c457abda6e670a9408901",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "0dfd01354d5843198c08cb6a0950e8c0",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G8-T66",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "2c1a359db25f4dafa192a64440248088",
              "pb": "27cce5e7983c457abda6e670a9408901",
              "pc": "0dfd01354d5843198c08cb6a0950e8c0"
            }
          }
        }
      ]
    },
    {
      "grade": 9,
      "label": "כיתה ט׳",
      "emoji": "🎯",
      "groups": [
        {
          "key": "alg",
          "label": "אלגברה",
          "reducedProgram": false
        },
        {
          "key": "fun",
          "label": "פונקציות וגרפים",
          "reducedProgram": false
        },
        {
          "key": "geo",
          "label": "גיאומטריה — מרובעים ומשולשים",
          "reducedProgram": false
        },
        {
          "key": "spiral",
          "label": "גיאומטריה — חזרה והעמקה לקראת התיכון",
          "reducedProgram": false
        },
        {
          "key": "stat",
          "label": "בעיות, סטטיסטיקה והסתברות",
          "reducedProgram": false
        },
        {
          "key": "bridge",
          "label": "מעבר לחטיבה העליונה",
          "reducedProgram": false
        },
        {
          "key": "r9sep",
          "label": "ספטמבר",
          "reducedProgram": true
        },
        {
          "key": "r9oct",
          "label": "אוקטובר",
          "reducedProgram": true
        }
      ],
      "topics": [
        {
          "id": 1,
          "title": "חוק הפילוג המורחב",
          "description": "פתיחת מכפלת סוגריים, כינוס איברים, פישוט ביטויים, פתרון משוואות, זהויות ובעיות יישומיות.",
          "group": "alg",
          "icon": "branch",
          "noamTopicId": "G9-T02",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "fa1bf558e210495e98750875aa9b2d8a",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "994b48f29e724eb28a13e718f821343e",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "834b4889ead4449888960101f85053d4",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G9-T02",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "fa1bf558e210495e98750875aa9b2d8a",
              "pb": "994b48f29e724eb28a13e718f821343e",
              "pc": "834b4889ead4449888960101f85053d4"
            }
          }
        },
        {
          "id": 44,
          "title": "דו־איבר בריבוע",
          "description": "דפי עבודה לכיתה ט׳ בריבוע סכום וריבוע הפרש: נוסחאות הכפל המקוצר, פתיחת סוגריים ופישוט ביטויים. רמה א׳, רמה ב׳ ומצוינות.",
          "group": "alg",
          "icon": "power",
          "noamTopicId": "G9-T44",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "b74fba1acf804f27be8dc4f785d1a002",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "5be1af0651d142648da6c08d0ff028f4",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "5dbd91577b8f4ac1a94947583a6e5140",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G9-T44",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "b74fba1acf804f27be8dc4f785d1a002",
              "pb": "5be1af0651d142648da6c08d0ff028f4",
              "pc": "5dbd91577b8f4ac1a94947583a6e5140"
            }
          }
        },
        {
          "id": 45,
          "title": "הפרש ריבועים",
          "description": "דפי עבודה לכיתה ט׳ בזיהוי הפרש ריבועים, פירוק לגורמים ובמכפלת סכום והפרש, עם תרגול מדורג ברמה א׳, רמה ב׳ ומצוינות.",
          "group": "alg",
          "icon": "factor",
          "noamTopicId": "G9-T45",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "e411b71b6b02446ea943eef41430f56a",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "7cf739195a244b8aad4a77a4a35230b8",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "425c4cfaa0834530abde0f5aa8347128",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G9-T45",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "e411b71b6b02446ea943eef41430f56a",
              "pb": "7cf739195a244b8aad4a77a4a35230b8",
              "pc": "425c4cfaa0834530abde0f5aa8347128"
            }
          }
        },
        {
          "id": 2,
          "title": "פירוק לגורמים",
          "description": "גורם משותף, נוסחאות כפל מקוצר, הפרש ריבועים, טרינום, קיבוץ ושילוב בין שיטות, משוואות ושברים אלגבריים.",
          "group": "alg",
          "icon": "factor",
          "noamTopicId": "G9-T03",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "2a6385d4e649433e89a2636d05be7e99",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "d30723feb0db4613bd2be70218a022fd",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "75190762fa9f4ea68781ee676892b877",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G9-T03",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "2a6385d4e649433e89a2636d05be7e99",
              "pb": "d30723feb0db4613bd2be70218a022fd",
              "pc": "75190762fa9f4ea68781ee676892b877"
            }
          }
        },
        {
          "id": 41,
          "title": "פירוק לגורמים 1 — הוצאת גורם משותף",
          "description": "זיהוי גורם משותף והוצאתו מחוץ לסוגריים, ותרגול פירוק לגורמים.",
          "group": "alg",
          "icon": "factor",
          "parent": 2,
          "noamTopicId": "G9-T41",
          "levels": [
            {
              "key": "a",
              "label": "גורם משותף · רמה א׳",
              "pdfId": "3f9546987fea4b9aa4294249ea017278",
              "labelSource": "topic.aLabel"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G9-T41",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "3f9546987fea4b9aa4294249ea017278"
            }
          }
        },
        {
          "id": 42,
          "title": "פירוק לגורמים 2 — נוסחאות הכפל המקוצר וטרינום",
          "description": "פירוק לגורמים בעזרת נוסחאות הכפל המקוצר וטרינום, ובחירת השיטה המתאימה.",
          "group": "alg",
          "icon": "factor",
          "parent": 2,
          "noamTopicId": "G9-T42",
          "levels": [
            {
              "key": "a",
              "label": "כפל מקוצר וטרינום · רמה א׳",
              "pdfId": "3329215ba8e24999b3522228011baae2",
              "labelSource": "topic.aLabel"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G9-T42",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "3329215ba8e24999b3522228011baae2"
            }
          }
        },
        {
          "id": 43,
          "title": "פירוק לגורמים 3 — פירוק מלא, משוואות ושברים אלגבריים",
          "description": "תרגול מצוינות בשילוב שיטות פירוק לגורמים, פתרון משוואות ועבודה עם שברים אלגבריים.",
          "group": "alg",
          "icon": "factor",
          "parent": 2,
          "noamTopicId": "G9-T43",
          "levels": [
            {
              "key": "c",
              "label": "פירוק מלא ומשוואות · רמת מצוינות",
              "pdfId": "9764420460f84628acbffb2ea2ee53a5",
              "labelSource": "topic.cLabel"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G9-T43",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pc": "9764420460f84628acbffb2ea2ee53a5"
            }
          }
        },
        {
          "id": 3,
          "title": "צמצום שברים אלגבריים",
          "description": "פירוק לגורמים של מונה ומכנה, תחום הגדרה, צמצום שברים עם נוסחאות כפל מקוצר וטרינומים.",
          "group": "alg",
          "icon": "frac",
          "noamTopicId": "G9-T04",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "07706ef6012b4f3487fc78a202683446",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "c3b506571f2242318be45b8d0781ef9d",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "d7a256871d934e509ed79e5da82d6da1",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G9-T04",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "07706ef6012b4f3487fc78a202683446",
              "pb": "c3b506571f2242318be45b8d0781ef9d",
              "pc": "d7a256871d934e509ed79e5da82d6da1"
            }
          }
        },
        {
          "id": 4,
          "title": "משולש שווה־שוקיים",
          "description": "ישרים מקבילים וזוויות, תכונות משולש שווה-שוקיים, זוויות בסיס, חוצה זווית ושאלות הוכחה. הקדמה לדלתון.",
          "group": "geo",
          "icon": "tritick",
          "noamTopicId": "G9-T15",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "5fd61b60905643f387e752881de3dbcf",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "d11f2f0d17b3432a92571f3b2bb805d4",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "ddfdb423c2dc4e9d925ee5be56971195",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G9-T15",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "5fd61b60905643f387e752881de3dbcf",
              "pb": "d11f2f0d17b3432a92571f3b2bb805d4",
              "pc": "ddfdb423c2dc4e9d925ee5be56971195"
            }
          }
        },
        {
          "id": 5,
          "title": "הפונקציה הריבועית",
          "description": "הצגות הפרבולה, קודקוד וציר סימטריה, נקודות אפס, הזזות, תחומים, פרמטרים וחיתוך בין גרפים.",
          "group": "fun",
          "icon": "parabola",
          "noamTopicId": "G9-T06",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "3c1e37115eca4b69bb8daf90565a7c1d",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "c514c4cd526e4ac68a61d0521e7ee022",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "cff4758892e44743bbff84e4a9920a86",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G9-T06",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "3c1e37115eca4b69bb8daf90565a7c1d",
              "pb": "c514c4cd526e4ac68a61d0521e7ee022",
              "pc": "cff4758892e44743bbff84e4a9920a86"
            }
          }
        },
        {
          "id": 6,
          "title": "משוואות ריבועיות ונוסחת השורשים",
          "description": "פתרון משוואות ריבועיות בעזרת נוסחת השורשים ובפירוק לגורמים, דיסקרימיננטה ומספר הפתרונות ובעיות יישום.",
          "group": "alg",
          "icon": "root",
          "noamTopicId": "G9-T31",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "3ae0575b833f45a59616944111af5324",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "5b9c4787bb8d4114b21abf4a6e569210",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "0d88c0d15f97493c8d2c1eac5dac8fbf",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G9-T31",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "3ae0575b833f45a59616944111af5324",
              "pb": "5b9c4787bb8d4114b21abf4a6e569210",
              "pc": "0d88c0d15f97493c8d2c1eac5dac8fbf"
            }
          }
        },
        {
          "id": 46,
          "title": "דלתון",
          "description": "זיהוי דלתון, שני זוגות של צלעות סמוכות שוות, קודקודי ראש וצד, אלכסון ראשי ומשני, שטח, היקף והוכחות.",
          "group": "geo",
          "icon": "star",
          "noamTopicId": "G9-T46",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "5694f57628744ebeaa37f5eca2c92b2a",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "7500a1a23e3840af8d8effd2675eb571",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "1278606e4a8c4313a2527dd1dad05629",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G9-T46",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "5694f57628744ebeaa37f5eca2c92b2a",
              "pb": "7500a1a23e3840af8d8effd2675eb571",
              "pc": "1278606e4a8c4313a2527dd1dad05629"
            }
          }
        },
        {
          "id": 7,
          "title": "המקבילית",
          "description": "זיהוי מקבילית, תכונות הצלעות, הזוויות והאלכסונים, שטח, היקף ושאלות הוכחה.",
          "group": "geo",
          "icon": "pgram",
          "noamTopicId": "G9-T17",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "963480052e8346d6a6a893b9586192f9",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "a606d9fa15bd4a94a5793fbfb6cd710d",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "2704db9ce5e44645830bb3ea18fb9541",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G9-T17",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "963480052e8346d6a6a893b9586192f9",
              "pb": "a606d9fa15bd4a94a5793fbfb6cd710d",
              "pc": "2704db9ce5e44645830bb3ea18fb9541"
            }
          }
        },
        {
          "id": 8,
          "title": "אי־שוויונות ריבועיים ומערכות משוואות",
          "description": "פתרון אי-שוויונות ריבועיים, מערכות לא-ליניאריות, חיתוך ישר ופרבולה ובעיות יישומיות.",
          "group": "fun",
          "icon": "lt",
          "noamTopicId": "G9-T07",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "b4335c05f6294bac8dd16b8273c8945b",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "7625185b14014f308b6befd0d27d65d8",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "be641e8b5d7146c58c35d430f979352b",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G9-T07",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "b4335c05f6294bac8dd16b8273c8945b",
              "pb": "7625185b14014f308b6befd0d27d65d8",
              "pc": "be641e8b5d7146c58c35d430f979352b"
            }
          }
        },
        {
          "id": 9,
          "title": "סטטיסטיקה",
          "description": "ממוצע, חציון, שכיח וטווח, טבלאות שכיחות, שכיחות יחסית ומצטברת, נתונים מקובצים וגרפים.",
          "group": "stat",
          "icon": "bars",
          "noamTopicId": "G9-T10",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "ceffef76a5d54060b0a9b77fcd3f7d75",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "f403eb0517fb43b9bd6b21f5c782f2ad",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "1297fef03a1544e39c5904206c75b46a",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G9-T10",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "ceffef76a5d54060b0a9b77fcd3f7d75",
              "pb": "f403eb0517fb43b9bd6b21f5c782f2ad",
              "pc": "1297fef03a1544e39c5904206c75b46a"
            }
          }
        },
        {
          "id": 10,
          "title": "הסתברות",
          "description": "מאורע משלים ואיחוד מאורעות, ניסויים רב-שלביים, עם וללא החזרה, תלות, עצמאות והסתברות מותנית.",
          "group": "stat",
          "icon": "dice",
          "noamTopicId": "G9-T11",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "175b22c6530447edbc183ea8589671e3",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "aafb63c1073e4cdb892782e919d65719",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "5403246d19ed4a93a8b7004cc3103243",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G9-T11",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "175b22c6530447edbc183ea8589671e3",
              "pb": "aafb63c1073e4cdb892782e919d65719",
              "pc": "5403246d19ed4a93a8b7004cc3103243"
            }
          }
        },
        {
          "id": 11,
          "title": "המלבן",
          "description": "זיהוי מלבן, תכונות הצלעות והזוויות, אלכסונים, פיתגורס, שטח, היקף והוכחות.",
          "group": "geo",
          "icon": "rect2",
          "noamTopicId": "G9-T18",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "8be86fcf1a7e48ad98b2c2adc12724ab",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "543140ba72214305b7f76c4318d6c941",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "594e3b89f7194ad49c73b740f40dd37f",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G9-T18",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "8be86fcf1a7e48ad98b2c2adc12724ab",
              "pb": "543140ba72214305b7f76c4318d6c941",
              "pc": "594e3b89f7194ad49c73b740f40dd37f"
            }
          }
        },
        {
          "id": 12,
          "title": "קדם אנליזה — מפונקציות לגרפים ובחזרה",
          "description": "קריאת גרפים, אפסים וקיצון, תחומי עלייה, ירידה, חיוביות ושליליות, טרנספורמציות, ערך מוחלט ומידול.",
          "group": "fun",
          "icon": "wave",
          "noamTopicId": "G9-T12",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "f3beac1ef5ee40eeb4130b6a5fae7ad2",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "77a5d6f0999c497f8439ccbbf0036ac3",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "1cb98617c4cd472785bc6a28c35d3dec",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G9-T12",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "f3beac1ef5ee40eeb4130b6a5fae7ad2",
              "pb": "77a5d6f0999c497f8439ccbbf0036ac3",
              "pc": "1cb98617c4cd472785bc6a28c35d3dec"
            }
          }
        },
        {
          "id": 13,
          "title": "המעוין",
          "description": "זיהוי מעוין, תכונות הצלעות והזוויות, אלכסונים מאונכים, שטח, היקף והוכחות.",
          "group": "geo",
          "icon": "rhomb",
          "noamTopicId": "G9-T19",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "182025dea59f4baf8f1bc79c641c17dd",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "41d31b1a4eea4ed998ed62e362bf258c",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "8db365cde371430c9104a8b0254058fc",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G9-T19",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "182025dea59f4baf8f1bc79c641c17dd",
              "pb": "41d31b1a4eea4ed998ed62e362bf258c",
              "pc": "8db365cde371430c9104a8b0254058fc"
            }
          }
        },
        {
          "id": 14,
          "title": "הריבוע",
          "description": "תכונות הריבוע, אלכסונים, פיתגורס, חישובי שטח והיקף, זיהוי ריבוע ושאלות הוכחה.",
          "group": "geo",
          "icon": "square2",
          "noamTopicId": "G9-T20",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "128c0bb142ae4f08a58ef4a4bdd041d4",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "5ad5c2be58ea41cc9fbb9ab10787f9d8",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "0db5d6a3180c482e95e61dbed062fd1e",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G9-T20",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "128c0bb142ae4f08a58ef4a4bdd041d4",
              "pb": "5ad5c2be58ea41cc9fbb9ab10787f9d8",
              "pc": "0db5d6a3180c482e95e61dbed062fd1e"
            }
          }
        },
        {
          "id": 39,
          "title": "הטרפז",
          "description": "זיהוי טרפז, בסיסים ושוקיים, זוויות ליד שוק, טרפז שווה־שוקיים וישר־זווית, שטח, היקף והוכחות.",
          "group": "geo",
          "icon": "star",
          "noamTopicId": "G9-T39",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "f82fb387aa674d29b416d8cdeb8384ff",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "7eb2f143944b4a3aa8620fb81f73a8e9",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "1c676026e49d4adeae45864911235727",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G9-T39",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "f82fb387aa674d29b416d8cdeb8384ff",
              "pb": "7eb2f143944b4a3aa8620fb81f73a8e9",
              "pc": "1c676026e49d4adeae45864911235727"
            }
          }
        },
        {
          "id": 15,
          "title": "גיאומטריה אנליטית",
          "description": "נקודות ושיקופים במערכת הצירים, מרחק ואמצע קטע, שיפוע ומשוואת ישר, שטחים וזיהוי מרובעים.",
          "group": "fun",
          "icon": "analytic",
          "noamTopicId": "G9-T08",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "e1cb29afc9744721ad729d6d3ba956be",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "5277db462624487ab9b1392973cfcdfe",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "da9cc4f6562d4612bab7dfded5c79a01",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G9-T08",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "e1cb29afc9744721ad729d6d3ba956be",
              "pb": "5277db462624487ab9b1392973cfcdfe",
              "pc": "da9cc4f6562d4612bab7dfded5c79a01"
            }
          }
        },
        {
          "id": 16,
          "title": "חוקי חזקות",
          "description": "חוקי חזקות, מעריך אפס ומעריך שלילי, פישוט ביטויים, משוואות, כתיב מדעי ויישומים.",
          "group": "alg",
          "icon": "power",
          "noamTopicId": "G9-T01",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "d7871990b85b4f24b3d033d19f4de35d",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "dba77d79bf104a539ed417ccfd472a35",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "307e4f57d1bf443d9d3e5d82b8c5b031",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G9-T01",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "d7871990b85b4f24b3d033d19f4de35d",
              "pb": "dba77d79bf104a539ed417ccfd472a35",
              "pc": "307e4f57d1bf443d9d3e5d82b8c5b031"
            }
          }
        },
        {
          "id": 17,
          "title": "שורשים",
          "description": "משמעות השורש, אומדן ופישוט, פעולות בשורשים, תחום הגדרה, משוואות ויישומים.",
          "group": "alg",
          "icon": "root",
          "noamTopicId": "G9-T05",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "6a42d3351d5b47eba7af9c60c5ef119c",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "a9665f8d88314a3da2e20ada5995987b",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "6f0f427e9c5646bba9ae56a0d00aa3d2",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G9-T05",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "6a42d3351d5b47eba7af9c60c5ef119c",
              "pb": "a9665f8d88314a3da2e20ada5995987b",
              "pc": "6f0f427e9c5646bba9ae56a0d00aa3d2"
            }
          }
        },
        {
          "id": 18,
          "title": "בעיות מילוליות",
          "description": "תרגום למשוואות ולמערכות, אחוזים, תנועה, הספק, תערובות, יחסים, גילאים ומודלים ריבועיים.",
          "group": "stat",
          "icon": "speech",
          "noamTopicId": "G9-T09",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "17798a629ec042b78d1dbabce87001b6",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "0ce1399d83c84ac482e04d50a2f042a9",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "e77d5e23afb24ad6813bd63dfb6cf9f3",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G9-T09",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "17798a629ec042b78d1dbabce87001b6",
              "pb": "0ce1399d83c84ac482e04d50a2f042a9",
              "pc": "e77d5e23afb24ad6813bd63dfb6cf9f3"
            }
          }
        },
        {
          "id": 40,
          "title": "דמיון משולשים — משפט ז.ז וחישובים",
          "description": "זיהוי דמיון לפי שתי זוויות, התאמת צלעות וחישוב אורכים באמצעות יחס הדמיון.",
          "group": "geo",
          "icon": "twotri2",
          "noamTopicId": "G9-T40",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "07a64e423dc04a5e8c1afca0e5fd2378",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "60c1d220383c413aaae3b2c75fcec769",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "72d87d8b638f4a98b5bd6a379030919f",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G9-T40",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "07a64e423dc04a5e8c1afca0e5fd2378",
              "pb": "60c1d220383c413aaae3b2c75fcec769",
              "pc": "72d87d8b638f4a98b5bd6a379030919f"
            }
          }
        },
        {
          "id": 19,
          "title": "דמיון משולשים",
          "description": "יחס דמיון, התאמת צלעות וזוויות, חישוב אורכים חסרים וקנה מידה.",
          "group": "geo",
          "icon": "twotri2",
          "noamTopicId": "G9-T32",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "9bb06971abc942498819b1640477546d",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "2c6b61aee35a48aa8d4a0560a3612eae",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "41d812848a9b439c8c4c330a838e6616",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G9-T32",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "9bb06971abc942498819b1640477546d",
              "pb": "2c6b61aee35a48aa8d4a0560a3612eae",
              "pc": "41d812848a9b439c8c4c330a838e6616"
            }
          }
        },
        {
          "id": 20,
          "title": "מעבר לחטיבה העליונה",
          "description": "חזרה ממוקדת לקראת כיתה י׳ — אלגברה, פונקציות וגיאומטריה, כהכנה ללימוד ברמת 4–5 יח״ל.",
          "group": "bridge",
          "icon": "steps",
          "noamTopicId": "G9-T13",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "020e644457d94727938bbfddfc9ac7a7",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "5f4af33988bf48079a960691ef5cf371",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "f7c4144305ba48f6a401d5b69526b295",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G9-T13",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "020e644457d94727938bbfddfc9ac7a7",
              "pb": "5f4af33988bf48079a960691ef5cf371",
              "pc": "f7c4144305ba48f6a401d5b69526b295"
            }
          }
        },
        {
          "id": 22,
          "title": "משולש שווה־צלעות — העמקה ורשות — לכיתה ט׳",
          "description": "תכונות וסימטריה, גובה ותיכון ושאלות אתגר ורשות. ברמת כיתה ט׳ — חזרה והעמקה לקראת התיכון.",
          "note": "דף חזרה מכיתה ז׳ לתרגול בכיתה ט׳.",
          "group": "spiral",
          "icon": "star",
          "noamTopicId": "G9-T16",
          "levels": [
            {
              "key": "one",
              "label": "דף יחיד — כל הרמות",
              "pdfId": "4a4af26aaede4dc3846c78f1bd7dba31",
              "labelSource": "default",
              "viewerLevel": "one"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G9-T16",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {},
            "sourceGrade": 7,
            "sourcePrefix": "G7-T16",
            "sourceTitle": "משולש שווה־צלעות — העמקה ורשות — כיתה ז׳"
          }
        },
        {
          "id": 23,
          "title": "מצולעים חופפים וטרנספורמציות — לכיתה ט׳",
          "description": "הזזה, שיקוף וסיבוב, זיהוי מצולעים חופפים והתאמת קודקודים. ברמת כיתה ט׳ — חזרה והעמקה לקראת התיכון.",
          "note": "דף חזרה מכיתה ז׳ לתרגול בכיתה ט׳.",
          "group": "spiral",
          "icon": "twotri",
          "noamTopicId": "G9-T21",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "00469caa9cc343ab945e5a4a826b6a88",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "f07020b2f513422892b3a501513b5c34",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "7ce31c71cf7740d2b1b9452592eed853",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G9-T21",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "00469caa9cc343ab945e5a4a826b6a88",
              "pb": "f07020b2f513422892b3a501513b5c34",
              "pc": "7ce31c71cf7740d2b1b9452592eed853"
            },
            "sourceGrade": 7,
            "sourcePrefix": "G7-T17",
            "sourceTitle": "מצולעים חופפים וטרנספורמציות (גיאומטריה) — כיתה ז׳"
          }
        },
        {
          "id": 24,
          "title": "פיתגורס חלק 1 — היכרות וחישוב — לכיתה ט׳",
          "description": "משפט פיתגורס, ניצבים ויתר, חישוב צלע חסרה ובדיקה אם המשולש ישר־זווית. ברמת כיתה ט׳ — חזרה והעמקה לקראת התיכון.",
          "note": "דף חזרה מכיתה ז׳ לתרגול בכיתה ט׳.",
          "group": "spiral",
          "icon": "pythag",
          "noamTopicId": "G9-T22",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "4776eb8d58fd4a75b66820018b897e17",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "bed47a7056dc440eae02dd5d5d34673f",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "d5d8a3ba151d47ef8e9159956ecb5263",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G9-T22",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "4776eb8d58fd4a75b66820018b897e17",
              "pb": "bed47a7056dc440eae02dd5d5d34673f",
              "pc": "d5d8a3ba151d47ef8e9159956ecb5263"
            },
            "sourceGrade": 7,
            "sourcePrefix": "G7-T42",
            "sourceTitle": "פיתגורס — היכרות וחישוב — כיתה ז׳"
          }
        },
        {
          "id": 25,
          "title": "פיתגורס חלק 2 — שימושים — לכיתה ט׳",
          "description": "שימוש בפיתגורס במלבן, בטרפז, בגובה משולש ובבעיות מהחיים. ברמת כיתה ט׳ — חזרה והעמקה לקראת התיכון.",
          "note": "דף חזרה מכיתה ז׳ לתרגול בכיתה ט׳.",
          "group": "spiral",
          "icon": "pythag",
          "noamTopicId": "G9-T23",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "2b1d3056caa1496b863765c957d2f942",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "bb0cc3bff3c6448b85bb56169ba5d1ef",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "5e2500ea4a014e849977fc098ea9a835",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G9-T23",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "2b1d3056caa1496b863765c957d2f942",
              "pb": "bb0cc3bff3c6448b85bb56169ba5d1ef",
              "pc": "5e2500ea4a014e849977fc098ea9a835"
            },
            "sourceGrade": 7,
            "sourcePrefix": "G7-T43",
            "sourceTitle": "פיתגורס חלק 2 — שימושים (גיאומטריה) — כיתה ז׳"
          }
        },
        {
          "id": 26,
          "title": "שטח מלבן וריבוע — העמקה — לכיתה ט׳",
          "description": "חישובי שטח, מציאת צלע חסרה, יחידות שטח ובעיות מורכבות. ברמת כיתה ט׳ — חזרה והעמקה לקראת התיכון.",
          "note": "דף חזרה מכיתה ז׳ לתרגול בכיתה ט׳.",
          "group": "spiral",
          "icon": "gridrect",
          "noamTopicId": "G9-T24",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "23c37b41a1184705974a4e6e276cf979",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "f0bddd29b1474f23bf0984116c46854d",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "9b91eb7cc20b4ad9bc48ac99c4ac87cc",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G9-T24",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "23c37b41a1184705974a4e6e276cf979",
              "pb": "f0bddd29b1474f23bf0984116c46854d",
              "pc": "9b91eb7cc20b4ad9bc48ac99c4ac87cc"
            },
            "sourceGrade": 7,
            "sourcePrefix": "G7-T18",
            "sourceTitle": "שטח מלבן וריבוע — העמקה — כיתה ז׳"
          }
        },
        {
          "id": 27,
          "title": "שטח משולש — העמקה — לכיתה ט׳",
          "description": "בסיס והגובה המתאים לו, גבהים במשולש קהה־זווית וחישובי שטח הפוכים. ברמת כיתה ט׳ — חזרה והעמקה לקראת התיכון.",
          "note": "דף חזרה מכיתה ז׳ לתרגול בכיתה ט׳.",
          "group": "spiral",
          "icon": "tridash",
          "noamTopicId": "G9-T25",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "774110467ff449c7bd6b725471b735e7",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "4784c763764643fd8ff94c9af521ee85",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "35199bf6314c4a9ebbfd447b2c73a5d5",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G9-T25",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "774110467ff449c7bd6b725471b735e7",
              "pb": "4784c763764643fd8ff94c9af521ee85",
              "pc": "35199bf6314c4a9ebbfd447b2c73a5d5"
            },
            "sourceGrade": 7,
            "sourcePrefix": "G7-T19",
            "sourceTitle": "שטח משולש – העמקה"
          }
        },
        {
          "id": 28,
          "title": "שטחים ב׳ חלק 1 — מקבילית וטרפז — לכיתה ט׳",
          "description": "נוסחאות שטח מקבילית וטרפז, זיהוי הגובה ומציאת נתון חסר. ברמת כיתה ט׳ — חזרה והעמקה לקראת התיכון.",
          "note": "דף חזרה מכיתה ז׳ לתרגול בכיתה ט׳.",
          "group": "spiral",
          "icon": "pgram",
          "noamTopicId": "G9-T26",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "e5e7f80a61704a47812ad8746c596b99",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "8970e00541ec4234bed08535fa14f392",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "30b21e08b07a45f5a2a78cc4b4d0a212",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G9-T26",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "e5e7f80a61704a47812ad8746c596b99",
              "pb": "8970e00541ec4234bed08535fa14f392",
              "pc": "30b21e08b07a45f5a2a78cc4b4d0a212"
            },
            "sourceGrade": 7,
            "sourcePrefix": "G7-T45",
            "sourceTitle": "שטחי מקבילית וטרפז — כיתה ז׳"
          }
        },
        {
          "id": 29,
          "title": "שטחים ב׳ חלק 2 — מצולעים מורכבים — לכיתה ט׳",
          "description": "פירוק לצורות מוכרות, חיסור שטחים ושאלות משולבות. ברמת כיתה ט׳ — חזרה והעמקה לקראת התיכון.",
          "note": "דף חזרה מכיתה ז׳ לתרגול בכיתה ט׳.",
          "group": "spiral",
          "icon": "lshape",
          "noamTopicId": "G9-T27",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "33bb88e3144345578e4748286dabed97",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "67caa6e8341841f7acaaf83107e85f75",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "df5624fb425541a7ba62f7f9d0221683",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G9-T27",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "33bb88e3144345578e4748286dabed97",
              "pb": "67caa6e8341841f7acaaf83107e85f75",
              "pc": "df5624fb425541a7ba62f7f9d0221683"
            },
            "sourceGrade": 7,
            "sourcePrefix": "G7-T46",
            "sourceTitle": "שטחי מצולעים מורכבים — כיתה ז׳"
          }
        },
        {
          "id": 30,
          "title": "מנסרה משולשת חלק 1 — מבנה ונפח — לכיתה ט׳",
          "description": "זיהוי המנסרה, בסיסים, מקצועות וגובה, חישוב נפח ומציאת נתון חסר. ברמת כיתה ט׳ — חזרה והעמקה לקראת התיכון.",
          "note": "דף חזרה מכיתה ז׳ לתרגול בכיתה ט׳.",
          "group": "spiral",
          "icon": "prism",
          "noamTopicId": "G9-T28",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "022d08c41e3c4ca38122150f4bfe5fe6",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "6d05ee624f5a41ba9ee6ce6f95032c30",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "4457125905df478dbe3708b198d3f9ba",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G9-T28",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "022d08c41e3c4ca38122150f4bfe5fe6",
              "pb": "6d05ee624f5a41ba9ee6ce6f95032c30",
              "pc": "4457125905df478dbe3708b198d3f9ba"
            },
            "sourceGrade": 7,
            "sourcePrefix": "G7-T47",
            "sourceTitle": "מנסרה משולשת חלק 1 — מבנה ונפח"
          }
        },
        {
          "id": 31,
          "title": "מנסרה משולשת חלק 2 — שטח פנים — לכיתה ט׳",
          "description": "פריסת המנסרה, שטח המעטפת, שטח הבסיסים ושטח הפנים הכולל. ברמת כיתה ט׳ — חזרה והעמקה לקראת התיכון.",
          "note": "דף חזרה מכיתה ז׳ לתרגול בכיתה ט׳.",
          "group": "spiral",
          "icon": "prism",
          "noamTopicId": "G9-T29",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "d11b7d930869421594088bc155e2643e",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "27c5582b89174963a432a5d8c1769f9e",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "460399b05e6046adbe518d2d87c32445",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G9-T29",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "d11b7d930869421594088bc155e2643e",
              "pb": "27c5582b89174963a432a5d8c1769f9e",
              "pc": "460399b05e6046adbe518d2d87c32445"
            },
            "sourceGrade": 7,
            "sourcePrefix": "G7-T48",
            "sourceTitle": "מנסרה משולשת חלק 2 — שטח פנים"
          }
        },
        {
          "id": 32,
          "title": "הרחבת מערכת הצירים חלק 2 — יישום והעמקה — לכיתה ט׳",
          "description": "מרחקים בין נקודות, צורות במערכת הצירים וחישובי היקף ושטח. ברמת כיתה ט׳ — חזרה והעמקה לקראת התיכון.",
          "note": "דף חזרה מכיתה ז׳ לתרגול בכיתה ט׳.",
          "group": "spiral",
          "icon": "analytic",
          "noamTopicId": "G9-T30",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "42d14e3577194ad883c2f2bcdffb141e",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "bc0639f3f80341fe96a9fa8c339efe7e",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "ba7bca690c5d48c0a4ca00eb38ef711a",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G9-T30",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "42d14e3577194ad883c2f2bcdffb141e",
              "pb": "bc0639f3f80341fe96a9fa8c339efe7e",
              "pc": "ba7bca690c5d48c0a4ca00eb38ef711a"
            },
            "sourceGrade": 7,
            "sourcePrefix": "G7-T10",
            "sourceTitle": "מערכת הצירים – יישום והעמקה"
          }
        },
        {
          "id": 33,
          "title": "גיאומטריה חישובית — משולש",
          "description": "סכום זוויות, שטח והיקף, קטעים מיוחדים במשולש, ושילוב במערכת צירים.",
          "group": "r9sep",
          "icon": "star",
          "noamTopicId": "G9-T33",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "f60779646afc4c938aa62b0a6a445859",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "5ccc99853352414f9268ce277cb2f42f",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "9b5d2671f12147bbb71b0411ec1daa7e",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G9-T33",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "f60779646afc4c938aa62b0a6a445859",
              "pb": "5ccc99853352414f9268ce277cb2f42f",
              "pc": "9b5d2671f12147bbb71b0411ec1daa7e"
            }
          }
        },
        {
          "id": 34,
          "title": "פונקציה קווית",
          "description": "שיפוע כקצב שינוי, ייצוג אלגברי וגרפי, נקודה על ישר, חיתוך עם הצירים, ישרים מקבילים.",
          "group": "r9oct",
          "icon": "star",
          "noamTopicId": "G9-T34",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "2e259f5011354d84840e15086c2672d3",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "053234fcb77840d5aa4ef6b0f98215a4",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "faa00b7dac144c1b8066ea16114df297",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G9-T34",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "2e259f5011354d84840e15086c2672d3",
              "pb": "053234fcb77840d5aa4ef6b0f98215a4",
              "pc": "faa00b7dac144c1b8066ea16114df297"
            }
          }
        },
        {
          "id": 35,
          "title": "משפט פיתגורס",
          "description": "חישובי צלעות, צורות מורכבות, היקפים ושטחים — כולל שורשים שאינם שלמים.",
          "group": "r9oct",
          "icon": "star",
          "noamTopicId": "G9-T35",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "e5aa2598a88943bab04b2947ff067db4",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "07ae9f4dcc5e4d1088469d8c2da07419",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "9d035a0049c2446c8767d88891e03948",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G9-T35",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "e5aa2598a88943bab04b2947ff067db4",
              "pb": "07ae9f4dcc5e4d1088469d8c2da07419",
              "pc": "9d035a0049c2446c8767d88891e03948"
            }
          }
        },
        {
          "id": 36,
          "title": "קריאת גרפים",
          "description": "קריאת מידע מגרף — ערך התחלתי, עלייה וירידה, קטע קבוע, נקודות חיתוך. בלי נוסחאות.",
          "group": "r9sep",
          "icon": "star",
          "noamTopicId": "G9-T36",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "92ea7c0c596845a591aca4aa03817dfc",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "8324b6f336164a3baed45637499978d5",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "d87fdf568d474d92bcca752dffef36e1",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G9-T36",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "92ea7c0c596845a591aca4aa03817dfc",
              "pb": "8324b6f336164a3baed45637499978d5",
              "pc": "d87fdf568d474d92bcca752dffef36e1"
            }
          }
        },
        {
          "id": 37,
          "title": "משולש ישר־זווית 30–60–90",
          "description": "דף עבודה בשלוש רמות — לפי פריסת ההוראה תשפ״ז.",
          "group": "spiral",
          "icon": "star",
          "noamTopicId": "G9-T37",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "2440da5aa9264f11b2e9613be35ce8be",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "8313ae1a3f6843e7b42e6613b4ec9ac8",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "1b93f94f61764dd49d69f861d9121941",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G9-T37",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "2440da5aa9264f11b2e9613be35ce8be",
              "pb": "8313ae1a3f6843e7b42e6613b4ec9ac8",
              "pc": "1b93f94f61764dd49d69f861d9121941"
            }
          }
        },
        {
          "id": 38,
          "title": "יחסי צלעות וזוויות",
          "description": "דף עבודה בשלוש רמות — לפי פריסת ההוראה תשפ״ז.",
          "group": "spiral",
          "icon": "star",
          "noamTopicId": "G9-T38",
          "levels": [
            {
              "key": "a",
              "label": "רמה א׳",
              "pdfId": "dbfe708e32bb40579124db1987eed6eb",
              "labelSource": "default"
            },
            {
              "key": "b",
              "label": "רמה ב׳",
              "pdfId": "da384a477a124b1fbfe2ec2a1c7d6971",
              "labelSource": "default"
            },
            {
              "key": "c",
              "label": "רמת מצוינות",
              "pdfId": "bf0b89ae4eb8453e9291d2834ab3c3f3",
              "labelSource": "default"
            }
          ],
          "routing": {
            "resolvedNoamPrefix": "G9-T38",
            "aiHintShown": true,
            "usesViewer": true,
            "viewerPath": "worksheet-viewer-noam.html",
            "siblingPdfQuery": {
              "pa": "dbfe708e32bb40579124db1987eed6eb",
              "pb": "da384a477a124b1fbfe2ec2a1c7d6971",
              "pc": "bf0b89ae4eb8453e9291d2834ab3c3f3"
            }
          }
        }
      ]
    }
  ]
};

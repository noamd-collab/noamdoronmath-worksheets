# Live round 2 replies for the figure tests

Byte-for-byte copies of model replies and lesson requests from live round 2
(2026-11-23, `gemini-3.8-flash`, engine a50bcb91), taken from
`handoff-20261123/m2-results/live2/<case>/` (`replies/reply-N.json`,
`lesson.json`). `tests/test_figure_routes.py` reads them; nothing replays them
as whole jobs, so they are not cases of `bench/corpus`.

| File | Case, reply | Why it is here |
| --- | --- | --- |
| `p3-reply-1.json`, `p3-reply-3.json`, `p3-lesson.json` | g9r:parallels_trapezoid e, author replies 1 and 2 | isosceles trapezoids sent to the scalene constructor |
| `square-reply-1.json`, `square-lesson.json` | g9m:square b (sent as `introduce`, replayed as `practice`), author reply 1 | one drawing on five questions and three reserves (G75) |
| `p1-reply-1.json`, `p1-reply-4.json`, `p1-lesson.json` | g9r:rhombus a, author reply 1 and correction reply 2 | a letter on an axis number; a parallelogram whose rhombus marks would answer its item |

SHA-256:

```
480b3b0372fe66580f6884b8df37a09d7f41b4d5e6b70a1b32ed23c5eed8077a  p1-lesson.json
6c8d45434e89bc9d2f28f8052fa7ffd2908341a7e700611174dfb6cc170b10c8  p1-reply-1.json
c0bdd45fddff470ecec29add30724d55cebe2998c65bec4bd0fa1b0598837227  p1-reply-4.json
c3e685ca16d9004ef27e7df832cf907067413efccc44bae53a140ef8ae3ba4c3  p3-lesson.json
3965c9f2f57037c383426dd7aa89cea50840e92867e9be624b89d870b495eb2c  p3-reply-1.json
212a76359615db4495ac9f1f7df3a097bd593505b60ab613d8242261a075f538  p3-reply-3.json
dae472f433ae607075987f0ae8dcfcd5c3db306424135e539740a98612da9167  square-lesson.json
a3b73e0a47c1de201dc0395249f7dc8ac5b889333935d064903613e7855aef4a  square-reply-1.json
```

The files hold worksheet content and lesson settings only: no key, token,
address or contact detail.

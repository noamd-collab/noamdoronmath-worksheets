/* Progressive enhancement for the public teacher landing. No AI/API calls. */
(() => {
  'use strict';
  const root = document.querySelector('.teacher-landing');
  if (!root || root.dataset.ready) return;
  root.dataset.ready = 'true';
  const gradeSelect = root.querySelector('#grade');
  const topicSelect = root.querySelector('#topic');
  const levelOptions = root.querySelector('#level-options');
  const openTool = root.querySelector('#open-tool');
  const editionLabel = root.querySelector('#edition-label');
  const status = root.querySelector('#catalog-status');
  const preview = root.querySelector('#preview');

  // Native dialog provides focus containment, Escape and focus restoration.
  root.querySelectorAll('#show-preview, #show-sample-link').forEach(button => {
    button.addEventListener('click', () => preview.showModal());
  });
  root.querySelector('#close-preview').addEventListener('click', () => preview.close());
  preview.addEventListener('click', event => {
    if (event.target !== preview) return;
    const bounds = preview.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) preview.close();
  });

  try {
    const catalog = JSON.parse(document.querySelector('#teacher-landing-data').textContent);
    let selectedLevel = catalog.defaultScope.level;
    const currentGrade = () => catalog.grades.find(item => item.grade === Number(gradeSelect.value));
    const currentTopic = () => currentGrade().topics.find(item => item.id === Number(topicSelect.value));

    function updateLink() {
      const topic = currentTopic();
      const params = new URLSearchParams({
        grade: gradeSelect.value,
        topic: topicSelect.value,
        level: selectedLevel,
        edition: topic.edition.id,
      });
      openTool.href = '/teachers/app?' + params.toString();
    }

    function renderLevels() {
      const topic = currentTopic();
      if (!topic.levels.some(item => item.value === selectedLevel)) selectedLevel = topic.defaultLevel;
      levelOptions.replaceChildren();
      for (const level of topic.levels) {
        const label = document.createElement('label');
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'level';
        radio.value = level.value;
        radio.checked = level.value === selectedLevel;
        const text = document.createElement('span');
        text.textContent = level.label;
        radio.addEventListener('change', () => {
          selectedLevel = radio.value;
          updateLink();
        });
        label.append(radio, text);
        levelOptions.append(label);
      }
      editionLabel.hidden = topic.edition.id === 'all' || topic.edition.id === 'legacy';
      editionLabel.textContent = topic.edition.label;
      updateLink();
    }

    function renderTopics(topicId) {
      topicSelect.replaceChildren();
      for (const topic of currentGrade().topics) topicSelect.add(new Option(topic.title, topic.id));
      if (currentGrade().topics.some(topic => topic.id === topicId)) topicSelect.value = String(topicId);
      renderLevels();
    }

    gradeSelect.addEventListener('change', () => {
      selectedLevel = 'a';
      renderTopics(Number(gradeSelect.value) === catalog.defaultScope.grade ? catalog.defaultScope.topic : undefined);
    });
    topicSelect.addEventListener('change', renderLevels);
    root.querySelector('#teacher-start').addEventListener('submit', event => {
      event.preventDefault();
      location.assign(openTool.href);
    });
    renderLevels();
    gradeSelect.disabled = false;
    topicSelect.disabled = false;
  } catch {
    // The SSR default example and its link remain useful even if enhancement fails.
    const fallback = document.createElement('a');
    fallback.href = '/teachers/app';
    fallback.textContent = 'פתיחת כלי המורים לבחירת כיתה ונושא';
    status.replaceChildren(document.createTextNode('הבחירה בעמוד לא נטענה. '), fallback);
  }
})();

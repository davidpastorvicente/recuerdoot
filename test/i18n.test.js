const { afterEach, describe, it } = require("node:test");
const assert = require("node:assert/strict");
const i18n = require("../assets/js/i18n.js");
const { validateQuestions } = require("../assets/js/quiz-pack.js");
const shared = require("../assets/js/game-shared.js");

const placeholders = (message) => {
  const forms = typeof message === "object" && !Array.isArray(message) ? Object.values(message) : [message];
  return [...new Set(forms.flatMap((form) => String(form).match(/\{[^}]+\}/g) ?? []))].sort();
};

describe("i18n", () => {
  afterEach(() => i18n.setLocale(i18n.DEFAULT_LOCALE));

  it("defaults to Spanish in Node", () => {
    assert.equal(i18n.getLocale(), "es");
    assert.equal(i18n.t("player.join"), "Unirse");
  });

  it("has the same keys and placeholders in every language", () => {
    const [base, ...others] = i18n.LOCALES;
    for (const locale of others) {
      assert.deepEqual(Object.keys(i18n.MESSAGES[locale]).sort(), Object.keys(i18n.MESSAGES[base]).sort(), locale);
      for (const [key, message] of Object.entries(i18n.MESSAGES[base])) {
        assert.deepEqual(placeholders(i18n.MESSAGES[locale][key]), placeholders(message), `${locale}: ${key}`);
      }
    }
  });

  it("interpolates params, picks plural forms and falls back to the key", () => {
    assert.equal(i18n.t("question.counter", { current: 2, total: 10 }), "Pregunta 2 de 10");
    assert.equal(i18n.t("lobby.start", { count: 1 }), "Empezar (1 jugador)");
    assert.equal(i18n.t("lobby.start", { count: 3 }), "Empezar (3 jugadores)");
    assert.equal(i18n.t("missing.key"), "missing.key");

    assert.equal(i18n.setLocale("en"), true);
    assert.equal(i18n.t("question.counter", { current: 2, total: 10 }), "Question 2 of 10");
    assert.equal(i18n.t("score.points", { count: 1 }), "1 point");
    assert.equal(i18n.t("score.points", { count: 0 }), "0 points");
    assert.equal(i18n.setLocale("fr"), false);
    assert.equal(i18n.getLocale(), "en");
  });

  it("escapes params in markup messages only", () => {
    assert.equal(i18n.tHtml("solo.correctWas", { answer: "<b>Ana</b>" }), 'La respuesta correcta era <strong class="text-success">&lt;b&gt;Ana&lt;/b&gt;</strong>');
    assert.equal(i18n.attrs("leaderboard.up", { count: 2 }, "aria-label"), 'data-i18n-aria-label="leaderboard.up" data-i18n-params="{&quot;count&quot;:2}"');
  });

  it("formats ISO dates in the current language", () => {
    assert.equal(i18n.formatDate("2019-07-04"), "4 julio 2019");
    assert.equal(i18n.t("reveal.date", { date: "2018-01-22" }), "22 enero 2018");
    i18n.setLocale("en");
    assert.equal(i18n.formatDate("2019-07-04"), "July 4, 2019");
    assert.equal(shared.parseDateParts("PTT-20190704-WA0001.mp3").date, "July 4, 2019");
    assert.equal(i18n.formatDate("not a date"), "not a date");
  });

  it("translates shared texts and validation problems", () => {
    i18n.setLocale("en");
    assert.equal(shared.formatQuestionCounter(0, 12), "Question 1 of 12");
    assert.deepEqual(validateQuestions([]), ["questions.json must contain at least one question"]);
    assert.deepEqual(validateQuestions([{ answers: { right: "A", wrong: ["B", "C", "D"] } }]), ['Question 1: "question" must be a non-empty text']);
  });
});

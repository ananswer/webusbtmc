// Light / dark theme. Load it in <head> (a classic script, not a module) so that the page does not flash.
// The choice (auto, light or dark) is kept in the browser and shared by all samples on this site.
(function () {
  'use strict';

  var KEY = 'tmc-theme';
  var CHOICES = ['auto', 'light', 'dark'];
  var root = document.documentElement;
  var media = window.matchMedia('(prefers-color-scheme: dark)');

  function load() {
    try {
      var value = localStorage.getItem(KEY);
      return CHOICES.indexOf(value) >= 0 ? value : 'auto';
    } catch (e) {
      return 'auto';
    }
  }

  function apply(choice) {
    var effective = choice === 'auto' ? (media.matches ? 'dark' : 'light') : choice;
    root.setAttribute('data-bs-theme', effective);   // Bootstrap
    if (choice === 'auto') {
      root.removeAttribute('data-theme');            // common.css follows the system
    } else {
      root.setAttribute('data-theme', choice);
    }
    window.dispatchEvent(new Event('tmc-themechange'));   // lets charts etc. redraw in the new colours
  }

  var choice = load();
  apply(choice);
  media.addEventListener('change', function () { apply(choice); });

  var ICONS = { auto: 'bi-circle-half', light: 'bi-sun', dark: 'bi-moon-stars' };
  var LABELS = { auto: 'Theme: auto', light: 'Theme: light', dark: 'Theme: dark' };

  function show(button) {
    var icon = button.querySelector('.bi');
    if (icon) {
      icon.className = 'bi ' + ICONS[choice];
    }
    button.setAttribute('aria-label', LABELS[choice] + '. Press to change.');
    button.setAttribute('title', LABELS[choice]);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var buttons = document.querySelectorAll('[data-theme-toggle]');
    buttons.forEach(function (button) {
      show(button);
      button.addEventListener('click', function () {
        choice = CHOICES[(CHOICES.indexOf(choice) + 1) % CHOICES.length];
        try { localStorage.setItem(KEY, choice); } catch (e) { /* the choice is just not remembered */ }
        apply(choice);
        buttons.forEach(show);
      });
    });
  });
})();

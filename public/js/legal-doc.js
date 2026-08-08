/* Legal document template behaviour (v3.1): ToC click → smooth scroll,
   scrollspy sets aria-current on the active section's ToC item. */
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    var items = Array.prototype.slice.call(document.querySelectorAll('.sa-toc__item'));
    var sections = items.map(function (b) { return document.getElementById('sec-' + b.getAttribute('data-sec')); }).filter(Boolean);

    function setActive(id) {
      items.forEach(function (b) {
        if (b.getAttribute('data-sec') === id) b.setAttribute('aria-current', 'true');
        else b.removeAttribute('aria-current');
      });
    }
    items.forEach(function (b) {
      b.addEventListener('click', function () {
        var sec = b.getAttribute('data-sec');
        setActive(sec);
        var el = document.getElementById('sec-' + sec);
        // Plain scrollTo: the smooth variant is a silent no-op under reduced
        // motion on some platforms, which reads as a dead control.
        if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.pageYOffset - 76);
      });
    });

    if (sections.length) setActive(sections[0].id.replace('sec-', ''));

    if ('IntersectionObserver' in window) {
      var visible = {};
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { visible[en.target.id] = en.isIntersecting; });
        for (var i = 0; i < sections.length; i++) {
          if (visible[sections[i].id]) { setActive(sections[i].id.replace('sec-', '')); break; }
        }
      }, { rootMargin: '-80px 0px -60% 0px' });
      sections.forEach(function (s) { io.observe(s); });
    }
  });
})();

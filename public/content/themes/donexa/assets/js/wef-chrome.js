/* WEF shared chrome behavior — sticky/overlay header, mobile drawer, dropdowns */
(function(){
  var overlay=document.querySelector('.wef-header--overlay');
  if(overlay){
    var onScroll=function(){ overlay.classList.toggle('wef-scrolled', window.scrollY>40); };
    onScroll(); window.addEventListener('scroll', onScroll, {passive:true});
  }
  var toggle=document.getElementById('wefNavToggle'),
      nav=document.getElementById('wefNav'),
      backdrop=document.getElementById('wefNavBackdrop');
  function closeNav(){ if(nav)nav.classList.remove('wef-open'); if(backdrop)backdrop.classList.remove('wef-show'); if(toggle)toggle.setAttribute('aria-expanded','false'); }
  if(toggle) toggle.addEventListener('click',function(){
    var open=nav.classList.toggle('wef-open');
    if(backdrop) backdrop.classList.toggle('wef-show', open);
    toggle.setAttribute('aria-expanded', open?'true':'false');
  });
  if(backdrop) backdrop.addEventListener('click', closeNav);
  document.querySelectorAll('.wef-has-children>.wef-navlink').forEach(function(a){
    a.addEventListener('click',function(e){
      if(window.innerWidth<=960){ e.preventDefault(); a.parentElement.classList.toggle('wef-sub-open'); }
      else if(a.getAttribute('href')==='#'){ e.preventDefault(); }
    });
  });
  if(nav) nav.querySelectorAll('a').forEach(function(a){
    a.addEventListener('click',function(){ if(window.innerWidth<=960 && a.getAttribute('href')!=='#') closeNav(); });
  });
}());

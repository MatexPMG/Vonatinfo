searchInput.addEventListener('input', () => {
  const query = searchInput.value.trim().toLowerCase();
  suggestionsBox.innerHTML = '';

  if (!query) {
    suggestionsBox.style.display = 'none';
    return;
  }

  const matches = Array.from(trainMarkers.keys())
    .filter(name => name.toLowerCase().includes(query))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || 0);
      const numB = parseInt(b.match(/\d+/)?.[0] || 0);
      return numA - numB;
    });

  if (matches.length === 0) {
    suggestionsBox.style.display = 'none';
    return;
  }

  matches.forEach(match => {
    const div = document.createElement('div');
    const [name, locPart] = match.split('|').map(s => s.trim());
    
    div.innerHTML = `${name} <span class="loc">| ${locPart}</span>`;

    div.onclick = () => {
      searchInput.value = match;
      simulateClick(match);
      suggestionsBox.style.display = 'none';
    };

    suggestionsBox.appendChild(div);
  });

  suggestionsBox.style.display = 'block';
});

searchInput.addEventListener('blur', () => {
  setTimeout(() => {
    suggestionsBox.style.display = 'none';
  }, 100);
});

searchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const input = searchInput.value.trim();
    const exact = trainMarkers.get(input);
    if (exact) {
      simulateClick(input);
    } else {
      const match = Array.from(trainMarkers.keys())
        .filter(k => k.toLowerCase().includes(input.toLowerCase()))
        .sort((a, b) => {
          const na = parseInt(a.match(/\d+/)?.[0] || 0);
          const nb = parseInt(b.match(/\d+/)?.[0] || 0);
          return na - nb;
        })[0];
      if (match) simulateClick(match);
    }
    suggestionsBox.style.display = 'none';
  }
});

function simulateClick(name) {
  const marker = trainMarkers.get(name);
  if (marker) {
    marker.fire('click');
    map.flyTo(marker.getLatLng(), 12, {
      duration: 0.1
    })
  }
  searchInput.value = '';
}
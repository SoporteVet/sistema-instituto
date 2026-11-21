// Lightweight navigation helper — avoids circular deps between router and views.
export function navigateTo(route) {
  window.location.hash = `#/${route}`;
}

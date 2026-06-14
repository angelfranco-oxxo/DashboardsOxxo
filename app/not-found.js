export default function NotFound() {
  return (
    <main style={{
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      background: '#000',
      color: '#fff',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 40 }}>404</h1>
        <p>No se encontro este dashboard.</p>
      </div>
    </main>
  );
}

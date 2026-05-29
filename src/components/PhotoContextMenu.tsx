// 📁 components/PhotoContextMenu.tsx

interface ContextMenuProps {
    x: number;
    y: number;
    photoId: number;
    tripId: number;
    onClose: () => void;
    onCoverSet: () => void;
  }

export const PhotoContextMenu: React.FC<ContextMenuProps> = ({ 
  x, y, photoId, tripId, onClose, onCoverSet 
}) => {
  const setCover = async () => {
    await fetch('/.netlify/functions/manage-trip', {
      method: 'POST',
      body: JSON.stringify({ action: 'SET_COVER', tripId, photoId })
    });
    onCoverSet();
    onClose();
  };

  return (
    <div style={{ position: 'fixed', top: y, left: x, background: 'white', border: '1px solid #ccc', padding: '5px', zIndex: 1000 }}>
      <button onClick={setCover}>Set as Album Cover</button>
    </div>
  );
};
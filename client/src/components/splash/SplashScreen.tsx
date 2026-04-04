import { useEffect, useState } from 'react';
import styles from './SplashScreen.module.css';

interface Props {
  onDone: () => void;
}

export function SplashScreen({ onDone }: Props) {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setFadeOut(true), 2800);
    const done = setTimeout(onDone, 3400);
    return () => { clearTimeout(timer); clearTimeout(done); };
  }, [onDone]);

  return (
    <div className={`${styles.splash} ${fadeOut ? styles.fadeOut : ''}`}>
      <div className={styles.content}>
        <img
          src="/splash.png"
          alt="Squawk — cartoon bird with devices"
          className={styles.splashImage}
        />
        <div className={styles.loader}>
          <div className={styles.loaderBar} />
        </div>
      </div>

      {/* Floating decorations */}
      <div className={`${styles.cloud} ${styles.cloud1}`}>☁️</div>
      <div className={`${styles.cloud} ${styles.cloud2}`}>☁️</div>
      <div className={`${styles.paperPlane} ${styles.plane1}`}>✈️</div>
    </div>
  );
}

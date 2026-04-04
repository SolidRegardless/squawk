import { useEffect, useState } from 'react';
import styles from './SplashScreen.module.css';

interface Props {
  onDone: () => void;
}

export function SplashScreen({ onDone }: Props) {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setFadeOut(true), 2200);
    const done = setTimeout(onDone, 2800);
    return () => { clearTimeout(timer); clearTimeout(done); };
  }, [onDone]);

  return (
    <div className={`${styles.splash} ${fadeOut ? styles.fadeOut : ''}`}>
      <div className={styles.content}>
        <div className={styles.logoContainer}>
          <span className={styles.parrot}>🦜</span>
          <h1 className={styles.title}>Squawk</h1>
        </div>
        <p className={styles.tagline}>Talk loud. Talk proud.</p>
        <div className={styles.dots}>
          <span className={styles.dot} />
          <span className={styles.dot} />
          <span className={styles.dot} />
        </div>
      </div>
    </div>
  );
}

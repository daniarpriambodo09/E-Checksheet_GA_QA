// hooks/useHomeData.ts
import { useState, useEffect } from 'react';

export function useHomeData() {
  const [data, setData] = useState<{ statistik: any; laporan: any } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statRes, laporanRes] = await Promise.all([
          fetch('/api/home/statistik'),
          fetch('/api/home/laporan-terbaru')
        ]);
        
        const statistik = await statRes.json();
        const laporan = await laporanRes.json();
        
        setData({ statistik, laporan });
      } catch (error) {
        console.error('Error fetching home data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return { data, loading };
}
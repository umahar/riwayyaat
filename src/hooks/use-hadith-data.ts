import { useCallback, useEffect, useState } from "react";
import { hadithInsights } from "@/lib/hadith/data";
import { HadithInsight } from "@/lib/hadith/types";

type UseHadithDataResult = {
  data: HadithInsight[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
};

export function useHadithData(): UseHadithDataResult {
  const [data, setData] = useState<HadithInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await new Promise((resolve) => setTimeout(resolve, 50));
      setData(hadithInsights);
    } catch (error) {
      console.error(error);
      setError("Unable to load hadith data.");
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return { data, loading, error, refresh: loadData };
}

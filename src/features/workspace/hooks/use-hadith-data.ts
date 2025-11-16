import { useCallback, useEffect, useState } from "react";
import { HadithInsight } from "@/features/hadith/types";

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
      const response = await fetch("/api/hadith");
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      const payload = (await response.json()) as { data: HadithInsight[] };
      setData(payload.data ?? []);
    } catch (error) {
      console.error("[useHadithData] Failed to load hadith", error);
      setError("Unable to load hadith data. Please try again.");
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

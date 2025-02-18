import { useCallback, useMemo, useRef, useState } from "preact/compat";
import { getLogHitsUrl } from "../../../api/logs";
import { ErrorTypes, TimeParams } from "../../../types";
import { LogHits } from "../../../api/types";
import dayjs from "dayjs";
import { LOGS_BARS_VIEW } from "../../../constants/logs";

export const useFetchLogHits = (server: string, query: string) => {
  const [logHits, setLogHits] = useState<LogHits[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ErrorTypes | string>();
  const abortControllerRef = useRef(new AbortController());

  const url = useMemo(() => getLogHitsUrl(server), [server]);

  const getOptions = (query: string, period: TimeParams, signal: AbortSignal) => {
    const start = dayjs(period.start * 1000);
    const end = dayjs(period.end * 1000);
    const totalSeconds = end.diff(start, "milliseconds");
    const step = Math.ceil(totalSeconds / LOGS_BARS_VIEW) || 1;

    return {
      signal,
      method: "POST",
      body: new URLSearchParams({
        query: query.trim(),
        step: `${step}ms`,
        start: start.toISOString(),
        end: end.toISOString(),
      })
    };
  };

  const fetchLogHits = useCallback(async (period: TimeParams) => {
    abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    setIsLoading(true);
    setError(undefined);

    try {
      const options = getOptions(query, period, signal);
      const response = await fetch(url, options);

      if (!response.ok || !response.body) {
        const text = await response.text();
        setError(text);
        setLogHits([]);
        setIsLoading(false);
        return Promise.reject(new Error(text));
      }

      const data = await response.json();
      const hits = data?.hits as LogHits[];
      if (!hits) {
        const error = "Error: No 'hits' field in response";
        setError(error);
        return Promise.reject(new Error(error));
      }

      setLogHits(hits);
    } catch (e) {
      if (e instanceof Error && e.name !== "AbortError") {
        setError(String(e));
        console.error(e);
        setLogHits([]);
      }
      return Promise.reject(e);
    } finally {
      setIsLoading(false);
    }
  }, [url, query]);

  return {
    logHits,
    isLoading,
    error,
    fetchLogHits,
  };
};

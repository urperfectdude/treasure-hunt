import { useEffect } from "react";
import { supabase } from "../lib/supabase";

// Subscribes to postgres_changes on `table` filtered by `column=value` and
// calls `onChange` for every insert/update/delete. Used both to drive
// simple table-bound state (player clue, team progress) and, on the host
// side, purely as a "something changed, go refetch the snapshot" signal.
export function useRealtimeTable(
  table: string,
  column: string,
  value: string | null | undefined,
  onChange: () => void,
) {
  useEffect(() => {
    if (!value) return;
    const channel = supabase
      .channel(`${table}:${column}:${value}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `${column}=eq.${value}` },
        onChange,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, column, value]);
}

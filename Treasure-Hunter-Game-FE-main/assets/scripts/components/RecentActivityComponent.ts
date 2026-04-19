// /components/RecentActivityComponent.ts
import { _decorator, Component, Node, Prefab, instantiate } from "cc";
import { RecentActivityRow } from "./RecentActivityRow";
import { EventBus } from "../core/EventBus";
import { GameEvent } from "../core/GameEvents";
import { NetworkService } from "../services/NetworkService";
import { GameConfig } from "../Config/GameConfig";
import { RecentActivityEntry } from "../types/GameTypes";

const { ccclass, property } = _decorator;

@ccclass("RecentActivityComponent")
export class RecentActivityComponent extends Component {
  @property(Node)
  public contentNode: Node | null = null;

  @property(Prefab)
  public rowPrefab: Prefab | null = null;

  private entries: RecentActivityEntry[] = [];
  private apiDataLoaded: boolean = false;
  private isRoundDetailOpen: boolean = false;

  onLoad() {
    EventBus.on(GameEvent.ROUND_DETAIL_OPENED, this.onRoundDetailOpened);
    EventBus.on(GameEvent.ROUND_DETAIL_CLOSED, this.onRoundDetailClosed);
    if (this.apiDataLoaded || this.entries.length > 0) return;
    this.refreshUI();
  }

  onDestroy() {
    EventBus.off(GameEvent.ROUND_DETAIL_OPENED, this.onRoundDetailOpened);
    EventBus.off(GameEvent.ROUND_DETAIL_CLOSED, this.onRoundDetailClosed);
    this.contentNode!.removeAllChildren();
    this.entries = [];
  }

  private onRoundDetailOpened = (): void => {
    this.isRoundDetailOpen = true;
  };

  private onRoundDetailClosed = (): void => {
    this.isRoundDetailOpen = false;
  };

  private async refreshUI() {
    this.entries.forEach((entry: RecentActivityEntry) => {
      const row = instantiate(this.rowPrefab!);
      if (row) {
        const rowComponent = row.getComponent(RecentActivityRow);

        if (rowComponent) {
          rowComponent.setData(entry, (betId) => {
            if (!this.isRoundDetailOpen) {
              EventBus.emit(GameEvent.RECENT_ROW_CLICKED, { betId });
            }
          });
        }
        this.contentNode!.addChild(row);
      }
    });
  }

  public loadFromAPI(payload: any) {
    try {
      const bets = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.results)
          ? payload.results
          : [];
      this.entries = bets.map(this.mapAPIToEntry);
      this.apiDataLoaded = true;

      this.refreshUI();
    } catch (e) {
      console.error("Failed to load API data:", e);
      this.refreshUI();
    }
  }

  private mapAPIToEntry = (bet: any): RecentActivityEntry => {
    const betAmount = Number(bet.betAmount ?? bet.amount ?? 0);
    const winAmount = Number(bet.winAmount ?? bet.payout ?? 0);
    const result = bet.betStatus;

    const shortenId = (id: string) => (id.length > 8 ? id.slice(-8) : id);

    const formatTime = (timeValue: string | Date): string => {
      if (!timeValue)
        return new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        });
      const date =
        typeof timeValue === "string" ? new Date(timeValue) : timeValue;
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
    };

    const fullId =
      bet.id != null
        ? String(bet.id)
        : bet.betId != null
          ? String(bet.betId)
          : "";
    return {
      roundId: fullId ? shortenId(fullId) : `R-${Date.now()}`,
      fullRoundId: fullId || undefined,
      time: formatTime(bet.createdAt ?? bet.time ?? new Date()),
      betAmount,
      winAmount,
      result,
    };
  };
  public clearHistory() {
    this.entries = [];
    this.refreshUI();
  }

  public clearData(): void {
    this.entries = [];
    this.apiDataLoaded = false;
    this.contentNode?.removeAllChildren();
  }

  public getEntries(): RecentActivityEntry[] {
    return [...this.entries];
  }
}

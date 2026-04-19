// /components/RecentActivityRow.ts
import { _decorator, Component, Label, Node, Color } from "cc";
import { RecentActivityEntry } from "../types/GameTypes";
const { ccclass, property } = _decorator;

@ccclass("RecentActivityRow")
export class RecentActivityRow extends Component {
  @property(Label) roundIdLabel: Label = null!;
  @property(Label) timeLabel: Label = null!;
  @property(Label) betLabel: Label = null!;
  //@property(Label) multiplierLabel: Label = null!;
  @property(Label) crashLevelLabel: Label = null!;
  @property(Label) resultLabel: Label = null!;
  @property(Label) profitLabel: Label = null!;

  private _betIdForApi: string = "";
  private _onClick?: (betId: string) => void;

  onLoad() {
    this.node.on(Node.EventType.TOUCH_END, this._handleClick, this);
  }

  onDestroy() {
    this.node.off(Node.EventType.TOUCH_END, this._handleClick, this);
    this.node.destroy();
  }

  private _handleClick() {
    if (this._betIdForApi && this._onClick) {
      this._onClick(this._betIdForApi);
    }
  }

  // Colors for profit display (chosen to contrast with #FFC691 background)
  private static readonly WIN_COLOR = new Color(34, 139, 34, 255); // Forest green
  private static readonly LOST_COLOR = new Color(178, 34, 34, 255); // Firebrick red

  public setData(
    entry: RecentActivityEntry,
    onClick?: (betId: string) => void,
  ) {
    this.roundIdLabel.string = entry.roundId;
    this.timeLabel.string = entry.time;
    this.betLabel.string = entry.betAmount.toFixed(2);
    // Show negative bet amount for lost bets, otherwise show win amount with colors
    if (entry.result === "LOST") {
      this.profitLabel.string = `-${entry.betAmount.toFixed(2)}`;
      this.profitLabel.color = RecentActivityRow.LOST_COLOR;
    } else {
      this.profitLabel.string = `+${entry.winAmount.toFixed(2)}`;
      this.profitLabel.color = RecentActivityRow.WIN_COLOR;
    }
    this.crashLevelLabel.string = entry.result;
    this._betIdForApi = entry.fullRoundId ?? entry.roundId;
    this._onClick = onClick;
  }
}

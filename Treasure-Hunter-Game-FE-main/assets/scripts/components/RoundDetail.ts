import { _decorator, Component, Label, Node, Prefab, instantiate, dragonBones, ScrollView } from "cc";
import { ANIM_NAME_BY_STATE, GameDifficulty, RecordAnimationState, RoundDetailData } from "../types/GameTypes";
import { MULTIPLIER_TABLES } from "../Config/GameConfig";
import { Step } from "./step";

const { ccclass, property } = _decorator;

@ccclass("RoundDetail")
export class RoundDetail extends Component {
  @property(Label) roundIdLabel: Label = null!;
  @property(Label) timeLabel: Label = null!;
  @property(Label) betLabel: Label = null!;
  @property(Label) betLabel1: Label = null!;
  @property(Label) multiplierLabel: Label = null!;
  @property(Label) multiplierLabel1: Label = null!;
  @property(Label) crashLevelLabel: Label = null!;
  @property(Label) resultLabel: Label = null!;
  @property(Label) betStatusLabel: Label = null!;
  @property(Label) crashPointLabel: Label = null!;
  @property(Label) betAmountLabel: Label = null!;
  @property(Label) winAmountLabel: Label = null!;
  @property(Label) lossAmountLabel: Label = null!;
  @property(Label) beforeBetBalanceLabel: Label = null!;
  @property(Label) afterBetBalanceLabel: Label = null!;
  @property(Label) gameDifficultyLabel: Label = null!;
  @property(Label) lastSteppedPointLabel: Label = null!;
  @property(Label) profitLabel: Label = null!;
  @property(Label) profitLabel1: Label = null!;
  @property(Label) difficultyMultiplierLabel: Label = null!;
  @property(Node) stepsContainer: Node = null!;
  @property(ScrollView) scrollView: ScrollView | null = null;

  @property(Node) private WinDeathRecords: Node = null!;
  @property(dragonBones.ArmatureDisplay) private recordAnimation: dragonBones.ArmatureDisplay = null!;
  @property(Prefab) stepPrefab: Prefab = null!;

  onLoad(): void { }

  public setData(data: RoundDetailData | { data: RoundDetailData }): void {
    const detail = this.getDetail(data);
    const difficulty = (detail.difficulty ?? detail.gameDifficulty) as GameDifficulty;
    const stepsArray = difficulty && MULTIPLIER_TABLES[difficulty]
      ? [...MULTIPLIER_TABLES[difficulty]]
      : [];

    const crashPoint = this.toNumber(detail.crashPoint);
    const cashOutPoint = this.toNumber(detail.cashOutPoint);
    const hasCashOut = this.hasValue(detail.cashOutPoint);
    this.populateSteps(stepsArray, crashPoint, cashOutPoint, hasCashOut);
    const profit = this.calculateProfit(detail);
    this.populateLabels(detail, profit);
    this.setRecordAnimation(detail.status ?? detail.betStatus ?? detail.result);
    this.scrollToTop();
  }

  private scrollToTop(): void {
    this.scheduleOnce(() => {
      const scrollView = this.getScrollView();
      if (scrollView) {
        scrollView.scrollToTop(0, false);
      }
    }, 0.05);
  }

  private getScrollView(): ScrollView | null {
    if (this.scrollView) return this.scrollView;
    if (!this.stepsContainer?.parent?.parent) return null;
    return this.stepsContainer.parent.parent.getComponent(ScrollView);
  }

  private getDetail(data: RoundDetailData | { data: RoundDetailData }): RoundDetailData {
    return (data as { data?: RoundDetailData }).data ?? (data as RoundDetailData) ?? {};
  }


  private calculateProfit(detail: RoundDetailData): number {
    const betAmount = this.toNumber(detail.betAmount ?? detail.amount);
    const multiplier = this.toNumber(detail.multiplier);
    const winAmount = this.toNumber(detail.winAmount ?? detail.payout);
    const lossAmount = this.toNumber(detail.lossAmount);

    if (this.hasValue(detail.winAmount) || this.hasValue(detail.lossAmount)) {
      return winAmount - lossAmount;
    }
    return betAmount * multiplier;
  }

  private populateLabels(detail: RoundDetailData, profit: number): void {
    const labels: Array<[Label | null, unknown]> = [
      [this.roundIdLabel, detail.id ?? detail.betId],
      [this.timeLabel, this.formatTime(detail.createdAt ?? detail.time)],
      [this.betLabel, detail.betAmount ?? detail.amount],
      [this.betLabel1, detail.betAmount ?? detail.amount],
      [this.multiplierLabel, detail.multiplier],
      [this.multiplierLabel1, detail.multiplier],
      [this.crashLevelLabel, detail.crashLevel],
      [this.resultLabel, detail.result ?? detail.betStatus],
      [this.afterBetBalanceLabel, detail.afterBetBalance != null ?
        (Math.floor(this.toNumber(detail.afterBetBalance) * 100) / 100) : undefined],
      [this.beforeBetBalanceLabel, detail.beforeBetBalance],
      [this.betAmountLabel, detail.betAmount ?? detail.amount],
      [this.winAmountLabel, detail.winAmount ?? detail.payout],
      [this.lossAmountLabel, detail.lossAmount],
      [this.betStatusLabel, detail.status ?? detail.betStatus],
      [this.crashPointLabel, detail.crashPoint],
      [this.gameDifficultyLabel, detail.gameDifficulty ?? detail.difficulty],
      [this.lastSteppedPointLabel, detail.lastSteppedPoint],
    ];

    for (const [label, value] of labels) {
      this.setLabelText(label, value);
    }

    this.setMoneyText(this.profitLabel, profit);
    this.setMoneyText(this.profitLabel1, detail.status === "LOST" ?
      profit : profit + this.toNumber(detail.betAmount));
  }

  private populateSteps(stepsArray: number[], crashPoint: number, cashOutPoint: number, hasCashOut: boolean): void {
    if (!this.stepsContainer || !this.stepPrefab) return;

    this.stepsContainer.removeAllChildren();
    stepsArray.forEach((multiplier, i) => {
      const stepNode = instantiate(this.stepPrefab);
      const stepComponent = stepNode.getComponent(Step);
      if (stepComponent) {
        const index = i + 1;
        stepComponent.setData(multiplier, index, crashPoint, cashOutPoint, hasCashOut);
      }
      this.stepsContainer.addChild(stepNode);
    });
  }

  private setRecordAnimation(betStatus: unknown): void {
    if (!this.recordAnimation) return;
    const state = this.getRecordAnimationState(betStatus);
    this.recordAnimation.playAnimation(ANIM_NAME_BY_STATE[state], -1);
  }


  private getRecordAnimationState(betStatus: unknown): RecordAnimationState {
    const status = String(betStatus ?? "").toUpperCase();
    if (status === "WON") return RecordAnimationState.WIN;
    if (status === "LOST") return RecordAnimationState.DEATH;
    return RecordAnimationState.NEUTRAL;
  }


  private toNumber(value: unknown): number {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (typeof value === "string") {
      const parsed = parseFloat(value.replace(/[^\d.-]/g, ""));
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }

  private hasValue(value: unknown): boolean {
    return value !== null && value !== undefined && value !== "";
  }

  private setLabelText(label: Label | null, value: unknown): void {
    if (!label) return;
    label.string = this.hasValue(value) ? String(value) : "-";
  }

  private setMoneyText(label: Label | null, amount: number): void {
    if (!label) return;
    label.string = `$${amount.toFixed(2)}`;
  }

  private formatTime(value: unknown): string {
    if (!this.hasValue(value)) return "-";
    const date = new Date(String(value));
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }

  onDestroy(): void {
    this.node.destroy();
  }
}

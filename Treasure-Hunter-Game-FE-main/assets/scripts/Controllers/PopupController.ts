import { _decorator, Component, Button, Label } from "cc";
import { RecentActivityComponent } from "../components/RecentActivityComponent";
import { EventBus } from "../core/EventBus";
import { GameEvent } from "../core/GameEvents";

const { ccclass, property } = _decorator;


@ccclass("PopupController")
export class PopupController extends Component {
  @property({ type: Button })
  public closeButton: Button | null = null;

  @property({ type: Button })
  public increaseButton: Button | null = null;

  @property({ type: Button })
  public decreaseButton: Button | null = null;

  @property({ type: Label })
  public pageLabel: Label | null = null;

  private currentPage: number =  1;
  private currentLimit: number = 10;

  onLoad() {
    this.bindButton(this.closeButton, this.hide);
    this.bindButton(this.increaseButton, this.onIncreaseClicked);
    this.bindButton(this.decreaseButton, this.onDecreaseClicked);
  }

  onEnable() {
    this.currentPage = 1;
    this.currentLimit = 10;
    this.updatePageLabel();
  }

  onDestroy() {
    this.unbindButton(this.closeButton, this.hide);
    this.unbindButton(this.increaseButton, this.onIncreaseClicked);
    this.unbindButton(this.decreaseButton, this.onDecreaseClicked);
  }

  public show() {
    this.node.setPosition(0, 0, 0);
    this.node.active = true;
  }

  public hide() {
    const recentActivity = this.node.getComponentInChildren(RecentActivityComponent);
    if (recentActivity) recentActivity.clearData();
    this.node.active = false;
  }

  private bindButton(button: Button | null, callback: () => void) {
    if (!button) return;
    button.node.off(Button.EventType.CLICK);
    button.node.on(Button.EventType.CLICK, callback, this);
  }

  private unbindButton(button: Button | null, callback: () => void) {
    if (!button) return;
    button.node.off(Button.EventType.CLICK, callback, this);
  }

  private updatePageLabel() {
    if (this.pageLabel) {
      this.pageLabel.string = String(this.currentPage);
    }
  }

  private setPage(page: number) {
    this.currentPage = page;
    this.updatePageLabel();
    this.emitPageLoad();
  }

  private emitPageLoad() {
    EventBus.emit(GameEvent.RECENT_LOAD_PAGE, {
      page: this.currentPage,
      limit: this.currentLimit,
    });
  }

  private onIncreaseClicked() {
    this.setPage(this.currentPage + 1);
  }

  private onDecreaseClicked() {
    if (this.currentPage > 1) {
      this.setPage(this.currentPage - 1);
    }
  }
}
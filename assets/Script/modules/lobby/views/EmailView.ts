import { DataStore, Dialog, HTTP, LEnv, LobbyModuleInterface, Logger } from "../lcore/LCoreExports";
import { proto } from "../proto/protoLobby";

/**
 * 邮件页面
 */
export class EmailView extends cc.Component {

    // 为了能在 render 函数中取this
    private static instance: EmailView;
    // 邮件列表
    private emails: proto.lobby.IMsgMail[];
    // 选中的邮件
    private selectedEmail: proto.lobby.IMsgMail;
    private view: fgui.GComponent;
    private win: fgui.Window;

    private emailList: fgui.GList;

    private attachmentsList: fgui.GList;

    private emailContent: fgui.GObject;

    private emailTitle: fgui.GObject;

    private eventTarget: cc.EventTarget;

    public onMessage(data: ByteBuffer): void {
        Logger.debug("EmailView.onMessage");

    }

    protected onLoad(): void {

        this.eventTarget = new cc.EventTarget();

        const lm = <LobbyModuleInterface>this.getComponent("LobbyModule");
        const loader = lm.loader;
        loader.fguiAddPackage("lobby/fui_email/lobby_email");

        const view = fgui.UIPackage.createObject("lobby_email", "emailView").asCom;
        this.view = view;

        const win = new fgui.Window();
        win.contentPane = view;
        win.modal = true;

        this.win = win;
        this.win.show();

        EmailView.instance = this;

        this.initView();
    }

    protected onDestroy(): void {

        this.eventTarget.emit("destroy");
        this.win.hide();
        this.win.dispose();
    }

    private onCloseClick(): void {
        this.destroy();
    }

    private initView(): void {
        const closeBtn = this.view.getChild("closeBtn");
        closeBtn.onClick(this.onCloseClick, this);

        this.emailContent = this.view.getChild("textComponent").asCom.getChild("text");
        this.emailTitle = this.view.getChild("title");

        //附件列表
        this.attachmentsList = this.view.getChild("emailAttachmentList").asList;
        this.attachmentsList.itemRenderer = this.renderAttachmentListItem;

        this.attachmentsList.setVirtual();

        //邮件列表
        this.emailList = this.view.getChild("mailList").asList;

        this.emailList.itemRenderer = this.renderPhraseListItem;

        this.emailList.setVirtual();

        //拉取邮件
        this.loadEmail();
    }
    /**
     * 更新邮件列表
     * @param emailRsp 拉取的邮件
     */
    private updateList(emailRsp: proto.lobby.MsgLoadMail): void {
        EmailView.instance.emails = emailRsp.mails;
        this.emailList.numItems = EmailView.instance.emails.length;

        //默认选择第一个
        if (EmailView.instance.emails.length >= 1) {
            this.emailList.selectedIndex = 0;

            const email = EmailView.instance.emails[0];
            this.selectEmail(email, 0);
        }

    }

    /**
     * 刷新附件
     * @param index 第几个
     * @param obj 该UI对象
     */
    private renderAttachmentListItem(index: number, obj: fgui.GObject): void {

        const email = EmailView.instance.selectedEmail;
        const attachment = email.attachments;

        const count = obj.asCom.getChild("count");
        count.text = `x  ${attachment.num}`;

        const readController = obj.asCom.getController("c3");

        // 设置是否领取
        if (attachment.isReceive === true) {
            readController.selectedIndex = 0;
        } else {
            readController.selectedIndex = 1;
        }
        //  会有多个点击事件,先取消
        obj.offClick(undefined, undefined);

        obj.onClick(() => {
            if (attachment.isReceive === false) {

                EmailView.instance.takeAttachment(email);
            }
            // tslint:disable-next-line:align
        }, this);
    }

    /**
     * 刷新邮件列表Item
     * @param index 下标
     * @param obj 该UI对象
     */
    private renderPhraseListItem(index: number, obj: fgui.GObject): void {

        const email = EmailView.instance.emails[index];

        const readController = obj.asCom.getController("c1");

        // --是否已读
        if (email.isRead === false) {
            readController.selectedIndex = 0;
        } else {
            readController.selectedIndex = 1;
        }

        const title = obj.asCom.getChild("title");
        title.text = "邮件";

        //空白按钮，为了点击列表，并且保留item被选择的效果
        const btn = obj.asCom.getChild("spaceBtn");

        btn.onClick(() => {
            EmailView.instance.selectEmail(email, index);
            // tslint:disable-next-line:align
        }, this);

    }

    /**
     * 拉取邮件
     */
    private loadEmail(): void {
        const tk = DataStore.getString("token", "");
        const loadEmailUrl = `${LEnv.rootURL}${LEnv.loadMails}?&rt=1&tk=${tk}`;
        const msg = "正在拉取邮件......";

        const cb = (xhr: XMLHttpRequest, err: string) => {

            let errMsg;
            if (err !== null) {
                errMsg = `错误码:${err}`;
                Dialog.showDialog(errMsg);

            } else {
                errMsg = HTTP.hError(xhr);

                if (errMsg === null) {
                    const data = <Uint8Array>xhr.response;
                    // proto 解码登录结果
                    const emails = proto.lobby.MsgLoadMail.decode(data);
                    this.updateList(emails);
                }
            }

        };

        this.emailRequest(loadEmailUrl, msg, cb);

    }

    /**
     * 选中邮件
     * @param email 邮件
     * @param index 邮件index
     */
    private selectEmail(email: proto.lobby.IMsgMail, index: number): void {
        this.emailContent.text = email.content;
        this.emailTitle.text = email.title;

        //刷新附件
        const selectedEmail = email;
        EmailView.instance.selectedEmail = selectedEmail;

        if (selectedEmail !== null) {
            this.updateAttachmentsView();
        }

        if (email.isRead === false) {
            this.setRead(email, index);
        }
    }

    // 附件个数，现在暂时为1
    private updateAttachmentsView(): void {
        this.attachmentsList.numItems = 1;
    }

    /**
     * 将邮件设为已读
     * @param email 邮件
     * @param listIndex 邮件处于列表index
     */
    private setRead(email: proto.lobby.IMsgMail, listIndex: number): void {

        const tk = DataStore.getString("token", "");
        const setReadEmailUrl = `${LEnv.rootURL}${LEnv.setMailRead}?&tk=${tk}&mailID=${email.id}`;

        const cb = (xhr: XMLHttpRequest, err: string) => {

            let errMsg;
            if (err !== null) {
                errMsg = `错误码:${err}`;
                Dialog.showDialog(errMsg);

            } else {
                errMsg = HTTP.hError(xhr);

                if (errMsg === null) {

                    email.isRead = true;
                    const obj = this.emailList.getChildAt(listIndex);
                    const readController = obj.asCom.getController("c1");
                    readController.selectedIndex = 1;
                }
            }
        };

        this.emailRequest(setReadEmailUrl, null, cb);

    }

    /**
     *  领取邮件的附件
     * @param email 邮件
     */
    private takeAttachment(email: proto.lobby.IMsgMail): void {
        const tk = DataStore.getString("token", "");
        const setReadEmailUrl = `${LEnv.rootURL}${LEnv.receiveAttachment}?&tk=${tk}&mailID=${email.id}`;

        const cb = (xhr: XMLHttpRequest, err: string) => {

            let errMsg;
            if (err !== null) {
                errMsg = `错误码:${err}`;
                Dialog.showDialog(errMsg);

            } else {
                errMsg = HTTP.hError(xhr);

                if (errMsg === null) {

                    const obj = this.attachmentsList.getChildAt(0);
                    const readController = obj.asCom.getController("c3");
                    readController.selectedIndex = 0;
                    email.attachments.isReceive = true;
                }
            }
        };

        this.emailRequest(setReadEmailUrl, null, cb);
    }

    /**
     * 网络请求
     * @param url 链接
     * @param msg 滚动圈弹的信息
     * @param cb 回调
     */
    private emailRequest(url: string, msg: string, cb: Function): void {
        if (url === null) {
            return null;
        }

        if (msg !== null) {
            Dialog.showDialog(msg);
        }

        Logger.debug("emailRequest url = ", url);

        HTTP.hGet(this.eventTarget, url, (xhr: XMLHttpRequest, err: string) => {
            Dialog.hideDialog();
            cb(xhr, err);
        });
    }

}

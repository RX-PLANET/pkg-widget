<template>
    <div class="c-payment-component">
        <div class="c-payment__header">
            <slot name="header"></slot>
        </div>

        <!-- 右侧：支付操作区 -->
        <div class="modal-main m-purchase-pay-main">
            <!-- 支付方式切换 -->
            <div class="payment-methods-grid">
                <slot name="payment-methods" :methods="paymentMethods" :active="activeMethod" :switch="switchPay">
                    <button
                        v-for="method in paymentMethods"
                        :key="method.value"
                        @click="switchPay(method.value)"
                        class="pay-method-btn"
                        :class="[
                            activeMethod === method.value ? 'active ' + method.activeClass : '',
                            method.customClass || '',
                        ]"
                    >
                        <i :class="method.icon" class="method-icon"></i>
                        <span class="method-label">{{ method.label }}</span>
                    </button>
                </slot>
            </div>

            <!-- 二维码区 -->
            <div class="qrcode-container">
                <div class="qr-wrapper">
                    <slot name="badge"></slot>
                    <div class="qrcode-box">
                        <!-- Loading 状态 -->
                        <div v-if="loading" class="loading-overlay">
                            <slot name="loading">
                                <i class="fas fa-spinner fa-spin loading-icon"></i>
                            </slot>
                        </div>

                        <!-- 显示二维码 -->
                        <QrcodeVue
                            v-else-if="qrcodeUrl"
                            :value="qrcodeUrl"
                            class="qrcode-image"
                            :size="160"
                            level="H"
                        />

                        <!-- 默认图标 -->
                        <slot v-else name="placeholder" :activeMethod="activeMethod">
                            <i
                                class="placeholder-icon"
                                :class="currentPaymentMethod?.icon || 'fas fa-qrcode'"
                            ></i>
                        </slot>
                    </div>
                </div>
                <div class="secure-badge">
                    <i class="fas fa-qrcode"></i>
                    <span>{{ t(`pay.${activeMethod === "wepay" ? "wechatScan" : "alipayScan"}`) }}</span>
                </div>

                <!-- 错误提示 -->
                <div v-if="errorMsg" class="error-message">
                    <slot name="error" :message="errorMsg">
                        {{ errorMsg }}
                    </slot>
                </div>
            </div>

            <!-- 底部插槽 -->
            <div class="footer-slot">
                <slot name="footer" :texts="texts">
                    <div class="m-agreement">
                        <i class="fas fa-shield-halved agreement-icon"></i>
                        <span class="agreement-text" v-html="t('pay.agreement')"></span>
                    </div>
                </slot>
            </div>
        </div>
    </div>
</template>

<script>
import QrcodeVue from "qrcode.vue";
import { createI18n } from "vue-i18n";
import enUs from "../../locale/en-us/payment";
import zhCn from "../../locale/zh-cn/payment";

// 创建独立的 i18n 实例
const getLocale = () => {
    const storedLanguage = localStorage.getItem('lang');
    if (!storedLanguage) {
        return navigator.language;
    } else {
        return storedLanguage;
    }
}

const payI18n = createI18n({
    locale: getLocale(),
    fallbackLocale: "zh-CN",
    messages: {
        "en-US": enUs,
        "zh-CN": zhCn,
    },
    legacy: false, // 使用 Composition API 模式
    warnHtmlInMessage: "off",
});

export default {
    name: "PaymentComponent",
    components: {
        QrcodeVue,
    },
    emits: ["close", "success", "payment-type-change", "error"],
    props: {
        // ===== API 配置 =====
        api: {
            type: Object,
            required: true,
            validator: (value) => {
                return (
                    typeof value.createOrder === "function" &&
                    typeof value.getOrderStatus === "function" &&
                    typeof value.getPaymentQRCode === "function" &&
                    typeof value.queryPaymentStatus === "function"
                );
            },
        },

        // ===== 订单参数 =====
        orderParams: {
            type: Object,
            required: true,
        },

        // ===== 默认支付方式 =====
        defaultPaymentType: {
            type: String,
            default: "wepay",
        },

        // ===== 自动开始 =====
        autoStart: {
            type: Boolean,
            default: false,
        },
        termLink: {
            type: String,
            default: "/link",
        },
    },
    data() {
        return {
            // 支付方式配置
            paymentMethods: [
                {
                    value: "wepay",
                    label: payI18n.global.t("pay.wechat"),
                    icon: "fab fa-weixin wepay-icon",
                    activeClass: "",
                    customClass: "wechat",
                    channel: "wepay",
                },
                {
                    value: "alipay",
                    label: payI18n.global.t("pay.alipay"),
                    icon: "fab fa-alipay alipay-icon",
                    activeClass: "",
                    customClass: "alipay",
                    channel: {
                        mobile: "alipay_wap",
                        pc: "alipay_pc",
                    },
                },
            ],

            // 文本配置
            texts: {
                createOrderFailed: payI18n.global.t("pay.createOrderFailed"),
                orderTimeout: payI18n.global.t("pay.orderTimeout"),
                orderFailed: payI18n.global.t("pay.orderFailed"),
                getQrcodeFailed: payI18n.global.t("pay.getQrcodeFailed"),
                paymentTimeout: payI18n.global.t("pay.paymentTimeout"),
                paymentFailed: payI18n.global.t("pay.paymentFailed"),
            },

            // 轮询配置
            pollingConfig: {
                orderInterval: 2000, // 每次轮询订单状态的间隔（毫秒），2000ms = 2 秒
                paymentInterval: 3000, // 每次轮询支付状态的间隔（毫秒），3000ms = 3 秒
                maxRetries: 60, // 最多轮询次数，超过后视为超时/失败
            },

            // 订单和支付信息
            pendingOrderId: null,
            paymentId: null,
            price: null,
            activeMethod: this.defaultPaymentType,
            qrcode: null,
            longUrl: null,
            skipUrl: null,
            paymentSuccess: false,

            // UI 状态
            loading: false,
            errorMsg: "",
            warningVisible: false,
            checking: false,

            // 轮询定时器
            orderPollingTimer: null,
            paymentPollingTimer: null,
            orderPollingRetries: 0,
            paymentPollingRetries: 0,
        };
    },
    computed: {
        isMobile() {
            return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        },

        currentPaymentMethod() {
            return this.paymentMethods.find((m) => m.value === this.activeMethod);
        },

        actualPayChannel() {
            const method = this.currentPaymentMethod;
            if (!method) return this.activeMethod;

            if (typeof method.channel === "string") {
                return method.channel;
            }

            if (typeof method.channel === "object") {
                return this.isMobile ? method.channel.mobile : method.channel.pc;
            }

            return this.activeMethod;
        },

        qrcodeUrl() {
            return this.qrcode || this.longUrl || null;
        },
    },
    watch: {
        defaultPaymentType: {
            handler(val) {
                this.activeMethod = val;
            },
            immediate: true,
        },
    },
    mounted() {
        if (this.autoStart) {
            this.startPaymentProcess();
        }
    },
    beforeUnmount() {
        this.clearAllTimers();
    },
    methods: {
        // ===== 公共方法 =====
        // 翻译函数
        t(key) {
            return payI18n.global.t(key);
        },
        async startPaymentProcess() {
            this.loading = true;
            this.errorMsg = "";
            await this.createOrder();
        },

        async switchPay(method) {
            if (this.activeMethod === method) return;

            this.activeMethod = method;
            this.errorMsg = "";
            this.$emit("payment-type-change", method);

            if (this.paymentId) {
                await this.getPaymentQrcode();
            }
        },

        resetPaymentState() {
            this.pendingOrderId = null;
            this.paymentId = null;
            this.price = null;
            this.qrcode = null;
            this.longUrl = null;
            this.skipUrl = null;
            this.paymentSuccess = false;
            this.loading = false;
            this.errorMsg = "";
            this.warningVisible = false;
            this.orderPollingRetries = 0;
            this.paymentPollingRetries = 0;
        },

        // ===== 支付流程 =====
        async createOrder() {
            try {
                const res = await this.api.createOrder(this.orderParams);
                if (res && res.id) {
                    this.pendingOrderId = res.id;
                    this.startOrderPolling();
                } else {
                    throw new Error(this.texts.createOrderFailed);
                }
            } catch (err) {
                this.handleError(this.texts.createOrderFailed, err);
            }
        },
        startOrderPolling() {
            this.orderPollingRetries = 0;

            this.orderPollingTimer = setInterval(async () => {
                try {
                    this.orderPollingRetries++;

                    if (this.orderPollingRetries > this.pollingConfig.maxRetries) {
                        this.clearTimer("order");
                        this.handleError(this.texts.orderTimeout);
                        return;
                    }

                    const response = await this.api.getOrderStatus(this.pendingOrderId);

                    if (response && response.status === 2) {
                        this.clearTimer("order");
                        this.paymentId = response.payment_id;
                        this.price = response.total_amount;
                        await this.getPaymentQrcode();
                    } else if (response && response.status === -1) {
                        this.clearTimer("order");
                        this.handleError(response.message || this.texts.orderFailed);
                    }
                } catch (err) {
                    console.error("Failed to poll order status:", err);
                }
            }, this.pollingConfig.orderInterval);
        },
        async getPaymentQrcode() {
            if (!this.paymentId) return;

            this.loading = true;
            this.errorMsg = "";

            try {
                const QR_PAY_MODE_ALIPAY_PC = 4;
                const params = {};
                if (this.actualPayChannel === "alipay_pc") {
                    params.qr_pay_mode = QR_PAY_MODE_ALIPAY_PC;
                }

                const response = await this.api.getPaymentQRCode(this.paymentId, this.actualPayChannel, params);

                if (response) {
                    this.qrcode = response.qrcode || response;
                    this.longUrl = response.long_url || response.longUrl;
                    this.skipUrl = response.skip_url || response.skipUrl;
                    this.loading = false;

                    if (!this.paymentPollingTimer) {
                        this.startPaymentPolling();
                    }
                } else {
                    throw new Error(this.texts.getQrcodeFailed);
                }
            } catch (err) {
                this.handleError(this.texts.getQrcodeFailed, err);
            }
        },

        startPaymentPolling() {
            this.paymentPollingRetries = 0;

            this.paymentPollingTimer = setInterval(async () => {
                try {
                    this.paymentPollingRetries++;

                    if (this.paymentPollingRetries > this.pollingConfig.maxRetries) {
                        this.clearTimer("payment");
                        this.warningVisible = true;
                        this.handleError(this.texts.paymentTimeout);
                        return;
                    }

                    const response = await this.api.queryPaymentStatus(this.paymentId);

                    if (response && response.status === 1) {
                        this.clearTimer("payment");
                        this.paymentSuccess = true;
                        setTimeout(() => {
                            this.$emit("success", {
                                paymentId: this.paymentId,
                                orderId: this.pendingOrderId,
                            });
                        }, 500);
                    } else if (response && response.status === "failed") {
                        this.clearTimer("payment");
                        this.warningVisible = true;
                        this.handleError(this.texts.paymentFailed);
                    }
                } catch (err) {
                    console.error("Failed to poll payment status:", err);
                }
            }, this.pollingConfig.paymentInterval);
        },

        // ===== 工具方法 =====
        handleError(message, error) {
            this.loading = false;
            this.errorMsg = message;
            this.$emit("error", { message, error });
            if (error) {
                console.error(message, error);
            }
        },

        clearTimer(type) {
            if (type === "order" && this.orderPollingTimer) {
                clearInterval(this.orderPollingTimer);
                this.orderPollingTimer = null;
            } else if (type === "payment" && this.paymentPollingTimer) {
                clearInterval(this.paymentPollingTimer);
                this.paymentPollingTimer = null;
            }
        },

        clearAllTimers() {
            this.clearTimer("order");
            this.clearTimer("payment");
        },
    },
};
</script>

<style lang="less">
.c-payment-component {
    // max-width: 28rem;
    width: 100%;
    background-color: #fff;
    color: #333;
    // border-radius: 1rem;
    padding: 2rem;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    border: 1px solid rgb(31 41 55);

    .m-agreement {
        display: flex;
        align-items: flex-start;
        justify-content: center;
        gap: 0.6rem;
        font-size: 0.75rem;
        color: #94a3b8;
        line-height: 1.5;
        max-width: 80%;
        margin: 0 auto;
        padding: 0.8rem 1rem;
        border-radius: 0.75rem;
        transition: all 0.3s ease;

        .agreement-icon {
            margin-top: 0.15rem;
            color: #64748b;
            font-size: 0.875rem;
        }

        .agreement-text {
            text-align: left;

            .u-link {
                color: #3b82f6;
                font-weight: 600;
                cursor: pointer;
                text-decoration: underline;
                text-underline-offset: 2px;

                &:hover {
                    color: #2563eb;
                }
            }
        }
    }
}

.c-payment__header {
    text-align: center;
    margin-top: 2rem;
    margin-bottom: 2rem;
}

.payment-methods-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    margin-bottom: 2rem;
}

.pay-method-btn {
    border-radius: 1rem;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    border: 2px solid rgba(0, 0, 0, 0.05);
    transition: all 0.3s;
    background: transparent;

    .method-icon {
        font-size: 1.5rem;
    }

    .method-label {
        font-size: 0.75rem;
        font-weight: 500;
    }

}
.wepay-icon {
    color: #10b981;
}

.alipay-icon {
    color: #3b82f6;
}

.pay-method-btn.active.wechat {
    border-color: #10b981;
    background: rgba(16, 185, 129, 0.05);
}

.pay-method-btn.active.alipay {
    border-color: #3b82f6;
    background: rgba(59, 130, 246, 0.05);
}

.qrcode-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
}

.qr-wrapper {
    background: white;
    padding: 12px;
    border-radius: 24px;
    position: relative;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
}

.qrcode-box {
    width: 11rem;
    height: 11rem;
    background-color: #f9fafb;
    border-radius: 0.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem;
    position: relative;
    overflow: hidden;
}

.loading-overlay {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: white;
    border-radius: 0.75rem;
}

.loading-icon {
    font-size: 1.875rem;
    color: #9ca3af;
}

.qrcode-image {
    width: 100%;
    height: 100%;
}

.placeholder-icon {
    font-size: 4.5rem;
}

.secure-badge {
    margin-top: 1.5rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #9ca3af;
    font-size: 0.75rem;
    background-color: rgba(255, 255, 255, 0.05);
    padding: 0.5rem 1rem;
    border-radius: 9999px;
}

.secure-icon {
    color: #10b981;
}

.error-message {
    margin-top: 1rem;
    color: #f87171;
    font-size: 0.75rem;
    text-align: center;
}

.footer-slot {
    margin-top: 2rem;
    text-align: center;
}

.m-purchase-pay-main {
    /* 左侧特权侧边栏 - 增加了图片背景风格 */
    .modal-sidebar {
        width: 35%;
        position: relative;
        padding: 40px 30px;
        border-right: 1px solid rgba(255, 255, 255, 0.05);
        overflow: hidden;
    }

    /* 背景压暗与渐变层 */
    .modal-sidebar::before {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(180deg, rgba(15, 23, 42, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%);
        z-index: 1;
    }

    .modal-sidebar > * {
        position: relative;
        z-index: 2;
    }

    /* 右侧支付主区 */
    .modal-main {
        width: 65%;
        padding: 40px;
        background: #0f172a;
        position: relative;
    }

    .badge-discount {
        position: absolute;
        top: -10px;
        right: -10px;
        background: #ef4444;
        color: white;
        padding: 4px 10px;
        border-radius: 10px;
        font-size: 10px;
        font-weight: 800;
        transform: rotate(10deg);
        box-shadow: 0 4px 10px rgba(239, 68, 68, 0.4);
        animation: pulse 2s infinite;
    }

    .u-title {
        color: #6a7282;
    }
    .m-purchase-feature-list {
        .u-icon {
            .size(32px);
            flex-shrink: 0;
        }
    }
    .u-avatar {
        .size(24px);
        overflow: hidden;
        .r(50%);
    }
    .u-mode {
        // background: rgba(255, 255, 255, 0.1);
        background-color: @primary;
        color: #fff;
        font-size: 10px;
        font-weight: 600;
        padding: 2px 6px;
        border-radius: 8px;
        margin-left: 8px;
        vertical-align: middle;
    }

    @keyframes pulse {
        0%,
        100% {
            transform: rotate(10deg) scale(1);
        }
        50% {
            transform: rotate(10deg) scale(1.1);
        }
    }

    @media (max-width: 640px) {
        .modal-container {
            flex-direction: column;
        }
        .modal-sidebar {
            width: 100%;
            padding: 20px;
        }
        .modal-main {
            width: 100%;
            padding: 20px;
        }
    }
}

/* 如果需要微调动画，可以在这里添加 */
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
</style>

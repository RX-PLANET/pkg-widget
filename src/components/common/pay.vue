<!-- 公共支付组件 -->
<template>
    <el-dialog
        class="c-pay-pop"
        :title="title || t('payment.title')"
        v-model="visible"
        :close-on-click-modal="false"
        :close-on-press-escape="false"
        :width="width"
    >
        <!-- 支付成功 -->
        <div v-if="paymentSuccess" class="success-container">
            <el-icon color="#67c23a" :size="64"><CircleCheck /></el-icon>
            <h3>{{ t('payment.success') }}</h3>
            <p>{{ t('payment.successDesc') }}</p>
        </div>

        <!-- 支付界面 -->
        <div v-else class="c-pay-pop-box">
            <!-- 支付方式切换 -->
            <el-tabs class="c-pay-pop-tab" v-model="payType" type="card" @tab-change="onPayTypeChange">
                <el-tab-pane :label="t('payment.wepay')" name="wepay">
                    <template #label>
                        <span class="u-tab">
                            <!-- <img src="../../assets/img/pay/wepay.svg" /> -->
                            <wePay></wePay>
                            {{ t('payment.wepay') }}
                            <em>{{ t('payment.wepayTip') }}</em>
                        </span>
                    </template>
                </el-tab-pane>
                <el-tab-pane :label="t('payment.alipay')" name="alipay">
                    <template #label>
                        <span class="u-tab">
                            <!-- <img src="../../assets/img/pay/alipay.svg" /> -->
                            <aliPay></aliPay>
                            {{ t('payment.alipay') }}
                            <em>{{ t('payment.alipayTip') }}</em>
                        </span>
                    </template>
                </el-tab-pane>
            </el-tabs>

            <!-- 支付内容 -->
            <div class="c-pay-pop-content">
                <h2 class="u-title">{{ productDesc }}</h2>
                <div class="u-price" v-if="price">
                    <b>{{ formatPrice(price) }}</b>
                    <em>{{ t('payment.currency') }}</em>
                </div>
                <div class="u-paybox">
                    <i class="u-qrcode" :class="{ 'u-wechat': isWepay, 'u-alipay': isAlipay }">
                        <!-- 支付宝 PC 使用 iframe -->
                        <iframe
                            v-if="isAlipayPc && longUrl && !paymentSuccess"
                            :src="longUrl"
                            width="300"
                            height="300"
                            frameborder="0"
                            class="u-iframe"
                        ></iframe>

                        <!-- 其他支付方式使用二维码 -->
                        <qrcode-vue
                            v-else-if="qrcode && !paymentSuccess"
                            class="u-pic"
                            :value="qrcode"
                            :size="300"
                            level="H"
                        ></qrcode-vue>

                        <!-- 支付成功提示(显示在二维码区域) -->
                        <div v-else-if="paymentSuccess && isAlipayPc" class="u-success-inline">
                            <el-icon color="#67c23a" :size="64"><CircleCheck /></el-icon>
                            <p>{{ t('payment.success') }}</p>
                        </div>

                        <!-- 加载中 -->
                        <div v-else class="u-loading">
                            <el-icon class="is-loading"><Loading /></el-icon>
                            <p>{{ t('payment.loadingQrcode') }}</p>
                        </div>
                    </i>
                    <span class="u-skip u-skip-alipay" v-if="isAlipay && skipUrl">
                        {{ t('payment.pcAlipay') }}<a :href="skipUrl" target="_blank">{{ t('payment.pcAlipayLink') }}</a>{{ t('payment.pcAlipaySuffix') }}
                    </span>
                    <span class="u-exp">{{ t('payment.expireTip') }}</span>
                    <transition name="fade">
                        <el-alert
                            class="u-warning"
                            v-show="warningVisible"
                            :title="t('payment.warningTitle')"
                            type="error"
                            show-icon
                            @close="closeWarning"
                        >
                        </el-alert>
                    </transition>
                </div>
            </div>
        </div>

        <!-- 底部按钮 -->
        <template #footer v-if="!paymentSuccess">
            <el-button @click="cancel">{{ t('payment.cancel') }}</el-button>
            <el-button type="primary" @click="checkPaymentStatus" :loading="checking">{{ t('payment.completed') }}</el-button>
        </template>
    </el-dialog>
</template>

<script>
import { Loading, CircleCheck } from '@element-plus/icons-vue';
import QrcodeVue from "qrcode.vue";
import { createI18n } from "vue-i18n";
import enUs from "../../locale/en-us";
import zhCn from "../../locale/zh-cn";
import wePay from "../../assets/img/pay/wepay.svg";
import aliPay from "../../assets/img/pay/alipay.svg";

// 创建独立的 i18n 实例
const getLocale = () => {
    const _val = localStorage.getItem('lang');
    if (!_val) {
        return navigator.language;
    } else {
        return _val;
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
    name: "Payment",
    components: {
        Loading,
        CircleCheck,
        QrcodeVue,
        wePay,
        aliPay,
    },
    // 使用独立的 i18n 实例
    i18n: payI18n,
    props: {
        // 弹窗可见性
        modelValue: {
            type: Boolean,
            default: false,
        },
        // 弹窗标题
        title: {
            type: String,
            default: payI18n.global.t('payment.title'),
        },
        // 弹窗宽度
        width: {
            type: String,
            default: '50%',
        },
        // 支付方式
        payMode: {
            type: String,
            default: 'wepay',
        },
        // 商品数量
        count: {
            type: Number,
            default: 1,
        },
        // 商品ID
        productId: {
            type: [String, Number],
            required: true,
        },
        // 商品描述
        productDesc: {
            type: String,
            default: '商品支付',
        },
        // 返回URL
        returnUrl: {
            type: String,
            default: '',
        },
        // 订单数据（如有多个商品）
        orderData: {
            type: Object,
            default: null,
        },
        // API 请求函数
        apiRequest: {
            type: Function,
            required: true,
            // 约定: (url, method, data) => Promise
        },
        // 轮询配置
        pollingConfig: {
            type: Object,
            default: () => ({
                orderInterval: 2000, // 订单状态轮询间隔(ms)
                paymentInterval: 3000, // 支付状态轮询间隔(ms)
                maxRetries: 60, // 最大轮询次数
            }),
        },
    },
    emits: ['update:modelValue', 'done', 'cancel', 'payment-success'],
    data() {
        return {
            visible: this.modelValue,
            loading: false,
            loadingText: payI18n.global.t('payment.loading'),

            // 订单相关
            pendingOrderId: null, // 订单预处理ID
            paymentId: null, // 支付单ID
            price: null, // 支付金额

            // 支付相关
            payType: this.payMode || 'wepay', // 当前支付方式: wepay/alipay
            qrcode: null, // 支付二维码URL或短链接
            longUrl: null, // 支付宝长链接(用于 iframe)
            skipUrl: null, // 支付宝跳转链接
            paymentSuccess: false, // 支付是否成功

            // UI 相关
            warningVisible: false, // 警告提示
            checking: false, // 是否正在检查支付状态

            // 轮询定时器
            orderPollingTimer: null,
            paymentPollingTimer: null,
            pollingRetries: 0,
        };
    },
    computed: {
        isWepay() {
            return this.payType === 'wepay';
        },
        isAlipay() {
            return this.payType === 'alipay';
        },
        // 检测是否为移动设备
        isMobile() {
            return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        },
        // 实际使用的支付渠道
        actualPayChannel() {
            if (this.payType === 'wepay') {
                return 'wepay';
            }
            // 支付宝根据设备类型选择渠道
            if (this.payType === 'alipay') {
                return this.isMobile ? 'alipay_wap' : 'alipay_pc';
            }
            return this.payType;
        },
        // 是否为 alipay_pc 模式
        isAlipayPc() {
            return this.actualPayChannel === 'alipay_pc';
        },
        params() {
            return {
                pay_type: this.payType,
                product_id: this.productId,
                return_url: this.returnUrl,
                count: this.count || 1,
            };
        },
    },
    watch: {
        // 双向绑定弹窗可见性
        modelValue(val) {
            this.visible = val;
            if (val && !this.qrcode) {
                this.startPaymentProcess();
            }
        },
        visible(val) {
            this.$emit('update:modelValue', val);
            if (!val) {
                // 关闭弹窗时清理定时器
                this.clearAllTimers();
            }
        },
        // 监听支付方式变化
        payMode(val) {
            this.payType = val;
        },
        // 监听参数变化重新创建订单
        params: {
            deep: true,
            handler() {
                if (this.visible) {
                    this.startPaymentProcess();
                }
            },
        },
    },
    mounted() {
        // 如果弹窗默认打开，则自动开始支付流程
        if (this.visible) {
            this.startPaymentProcess();
        }
    },
    beforeUnmount() {
        // 清理定时器
        this.clearAllTimers();
    },
    methods: {
        // 翻译函数
        t(key) {
            return payI18n.global.t(key);
        },

        // 格式化价格
        formatPrice(price) {
            return price / 100;
        },

        // 开始支付流程
        async startPaymentProcess() {
            await this.createOrder();
        },

        // 步骤1: 创建订单
        async createOrder() {
            try {
                this.loading = true;
                this.loadingText = payI18n.global.t('payment.loadingCreate');

                // 准备订单数据
                const orderParams = this.orderData || {
                    goods: [
                        {
                            product_sku_id: ~~this.productId,
                            count: this.count,
                        },
                    ]
                };

                // 调用下单接口
                const response = await this.apiRequest(
                    '/api/client/order/make/batch',
                    'POST',
                    orderParams
                );

                if (response && response.id) {
                    this.pendingOrderId = response.id;

                    // 开始轮询订单状态
                    this.startOrderPolling();
                } else {
                    throw new Error('创建订单失败,未返回订单ID');
                }
            } catch (err) {
                console.error('创建订单失败:', err);
                this.loading = false;
            }
        },

        // 步骤2: 轮询订单预处理状态
        startOrderPolling() {
            this.loadingText = payI18n.global.t('payment.loadingOrder');
            this.pollingRetries = 0;

            this.orderPollingTimer = setInterval(async () => {
                try {
                    this.pollingRetries++;

                    // 检查是否超过最大重试次数
                    if (this.pollingRetries > this.pollingConfig.maxRetries) {
                        this.clearAllTimers();
                        this.loading = false;
                        console.error('订单处理超时');
                        return;
                    }

                    // 查询订单预处理状态
                    const response = await this.apiRequest(
                        `/api/client/order/pending/item/${this.pendingOrderId}`,
                        'GET'
                    );

                    // status === 2 表示减库存成功,可以进行支付
                    if (response && response.status === 2) {
                        this.clearTimer('order');
                        this.paymentId = response.payment_id;
                        this.price = response.total_amount;

                        // 自动获取默认支付方式(微信)的二维码
                        await this.getPaymentQrcode();
                    } else if (response && response.status === -1) {
                        // 订单处理失败
                        this.clearAllTimers();
                        this.loading = false;
                        console.error('订单处理失败:', new Error(response.message || '订单处理失败'));
                    }
                } catch (err) {
                    console.error('轮询订单状态失败:', err);
                    // 继续轮询,不中断
                }
            }, this.pollingConfig.orderInterval);
        },

        // 支付方式切换
        async onPayTypeChange(newPayType) {
            // 切换支付方式时重新获取二维码
            this.qrcode = null;
            this.longUrl = null;
            this.skipUrl = null;
            await this.getPaymentQrcode();
        },

        // 步骤3: 获取支付二维码
        async getPaymentQrcode() {
            if (!this.paymentId) {
                return;
            }

            try {
                // 构建请求 URL,使用实际支付渠道
                let url = `/api/client/payment/item/${this.paymentId}/pay/${this.actualPayChannel}/qrcode`;

                // 如果是 alipay_pc,添加 qr_pay_mode=4 参数
                if (this.actualPayChannel === 'alipay_pc') {
                    url += '?qr_pay_mode=4';
                }

                // 调用获取支付二维码接口
                const response = await this.apiRequest(url, 'GET');

                if (response) {
                    // 根据支付渠道处理返回数据
                    if (this.actualPayChannel === 'alipay_pc') {
                        // PC 支付宝使用 long_url 显示 iframe
                        this.longUrl = response.long_url || response.longUrl;
                        this.qrcode = response.qrcode; // 备用
                    } else {
                        // 其他渠道使用 qrcode 生成二维码
                        this.qrcode = response.qrcode || response;
                        this.longUrl = response.long_url || response.longUrl;
                    }

                    this.skipUrl = response.skip_url || response.skipUrl; // 支付宝跳转链接
                    this.loading = false;

                    this.$emit('qrcode-generated', response);

                    // 开始轮询支付状态
                    if (!this.paymentPollingTimer) {
                        this.startPaymentPolling();
                    }
                } else {
                    throw new Error('获取支付二维码失败');
                }
            } catch (err) {
                this.loading = false;
                console.error('获取支付二维码失败:', err);
            }
        },

        // 步骤4: 轮询支付状态
        startPaymentPolling() {
            this.pollingRetries = 0;

            this.paymentPollingTimer = setInterval(async () => {
                try {
                    this.pollingRetries++;

                    // 检查是否超过最大重试次数
                    if (this.pollingRetries > this.pollingConfig.maxRetries) {
                        this.clearTimer('payment');
                        this.warningVisible = true;
                        return;
                    }

                    // 查询支付状态
                    const response = await this.apiRequest(
                        `/api/client/payment/item/${this.paymentId}/simple`,
                        'GET'
                    );

                    // 根据实际API返回的支付状态字段判断
                    if (response && (response.status === 1)) {
                        this.clearTimer('payment');
                        this.paymentSuccess = true;
                        this.$emit('payment-success', response);
                    } else if (response && response.status === 'failed') {
                        this.clearTimer('payment');
                        this.warningVisible = true;
                        console.error('支付失败:', response);
                    }
                } catch (err) {
                    console.error('轮询支付状态失败:', err);
                    // 继续轮询,不中断
                }
            }, this.pollingConfig.paymentInterval);
        },

        // 手动检查支付状态
        async checkPaymentStatus() {
            if (!this.paymentId) {
                this.$message?.error('无效订单号');
                return;
            }

            this.checking = true;
            this.warningVisible = false;

            try {
                const response = await this.apiRequest(
                    `/api/client/payment/item/${this.paymentId}/simple`,
                    'GET'
                );

                if (response && (response.status === 1)) {
                    this.clearTimer('payment');
                    this.paymentSuccess = true;
                    this.$emit('done', response);

                    // 延迟关闭弹窗并刷新
                    setTimeout(() => {
                        this.visible = false;
                        if (typeof location !== 'undefined') {
                            location.reload();
                        }
                    }, 2000);
                } else {
                    this.warningVisible = true;
                }
            } catch (err) {
                console.error('检查支付状态失败:', err);
            } finally {
                this.checking = false;
            }
        },

        // 取消支付
        cancel() {
            this.visible = false;
            this.$emit('cancel');
        },

        // 关闭警告
        closeWarning() {
            this.warningVisible = false;
        },        // 清理定时器
        clearTimer(type) {
            if (type === 'order' && this.orderPollingTimer) {
                clearInterval(this.orderPollingTimer);
                this.orderPollingTimer = null;
            } else if (type === 'payment' && this.paymentPollingTimer) {
                clearInterval(this.paymentPollingTimer);
                this.paymentPollingTimer = null;
            }
        },

        clearAllTimers() {
            this.clearTimer('order');
            this.clearTimer('payment');
        },

        // 重新生成二维码
        retry() {
            this.warningVisible = false;
            this.qrcode = null;
            this.longUrl = null;
            this.skipUrl = null;
            this.pendingOrderId = null;
            this.paymentId = null;
            this.price = null;
            this.paymentSuccess = false;
            this.pollingRetries = 0;
            this.loading = true;

            this.clearAllTimers();
            this.startPaymentProcess();
        },
    },
};
</script>

<style lang="less">
@import "../../assets/css/var.less";

.c-pay-pop {

    :deep(.el-dialog) {
        max-width: 980px;
    }

    :deep(.el-dialog__body) {
        padding: 0 10px;
    }

    .loading-container,
    .success-container {
        text-align: center;
        padding: 48px 24px;

        .el-icon {
            font-size: 48px;
            margin-bottom: 16px;
        }

        p {
            font-size: 16px;
            color: #606266;
            margin: 16px 0;
        }
    }

    .u-btns {
        text-align: center;
    }

    .c-pay-pop-box {
        padding: 10px;

        .c-pay-pop-tab {
            :deep(.el-tabs__header) {
                margin: 0;
            }

            :deep(.el-tabs__item) {
                height: 60px;
                line-height: 60px;
                font-size: 16px;
            }

            :deep(.el-tabs--card > .el-tabs__header .el-tabs__item.is-active) {
                background-color: #e6f0fb;
                border-bottom: none;
            }

            .u-tab {
                display: flex;
                align-items: center;
                color: @color;

                svg {
                    width: 24px;
                    height: 24px;
                    vertical-align: middle;
                    margin-right: 10px;
                }

                em {
                    font-size: 12px;
                    color: #999;
                    font-style: normal;
                    margin-left: 4px;
                    border: 1px solid #c0c4cc;
                    padding: 0 5px;
                    line-height: 14px;
                    background-color: #fff;
                    border-radius: 1px;
                }
            }
        }

        .c-pay-pop-content {
            padding: 10px;

            .u-title {
                text-align: center;
                font-size: 18px;
                color: @color;
                margin: 10px 0 5px 0;
                font-weight: 500;
            }

            .u-price {
                text-align: center;
                font-size: 24px;
                margin-bottom: 10px;

                b {
                    font-weight: bold;
                    color: #c00;
                }

                em {
                    font-size: 15px;
                    font-style: normal;
                    margin-left: 5px;
                }
            }

            .u-paybox {
                text-align: center;

                .u-qrcode {
                    width: 300px;
                    height: 300px;
                    display: block;
                    margin: 0 auto;
                    padding: 0;
                    background: #fff;
                    // border: 1px solid #dcdfe6;
                    // border-radius: 4px;

                    .u-pic {
                        width: 100%;
                        height: 100%;
                        display: block;
                    }

                    .u-iframe {
                        display: block;
                        border: none;
                        width: 300px;
                        height: 300px;
                    }

                    .u-success-inline {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        height: 100%;
                        color: #67c23a;

                        .el-icon {
                            margin-bottom: 16px;
                        }

                        p {
                            font-size: 18px;
                            font-weight: 500;
                            margin: 0;
                        }
                    }

                    .u-loading {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        height: 100%;
                        color: #909399;

                        .el-icon {
                            font-size: 32px;
                            margin-bottom: 12px;
                        }

                        p {
                            font-size: 14px;
                            margin: 0;
                        }
                    }

                    // &.u-wechat {
                    //     border-color: #09bb07;
                    // }

                    // &.u-alipay {
                    //     border-color: #1677ff;
                    // }
                }

                .u-skip {
                    display: block;
                    margin-top: 10px;
                    font-size: 14px;
                    color: #606266;

                    a {
                        color: @color-link;
                        text-decoration: none;

                        &:hover {
                            text-decoration: underline;
                        }
                    }
                }

                .u-exp {
                    color: #fba524;
                    display: block;
                    text-align: center;
                    font-size: 12px;
                    margin-top: 10px;
                }

                .u-warning {
                    width: 260px;
                    max-width: 100%;
                    margin: 20px auto 0 auto;
                }
            }
        }
    }
}

// Fade 过渡动画
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.5s;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}

// 移动端适配
@media screen and (max-width: @phone) {
    .c-payment {
        width: 100% !important;
        max-width: 100%;

        .c-pay-pop-box {
            border-radius: 0;
            box-shadow: none;
            max-height: 100%;
            overflow: auto;

            .c-pay-pop-content {
                .u-qrcode {
                    width: 100%;
                    max-width: 260px;
                }

                .u-warning {
                    width: 100%;
                    max-width: 260px;
                }
            }
        }
    }
}
</style>

jsonOrderHistoryStatusByIdGet: async (req, res, next) => {
		console.log('# Controller apiIndex.v2.jsonOrderStatusByIdGet')
		let resData = {
			code: 1,
			msg: null,
			data: {},
		}
		try {
			let mapDataDeal = {}
			let mapDataInsurance = {}
			let mapDetailOrder = {}
			let join = {
				withRelated: [{
					invoice: function (qb) { },
				}],
			}
			// set-default-for-test-deal
			_.set(req, 'user.id', '107')
			_.set(req, 'user.csmember_id', '5a1443ff-8824-4656-9b45-89767b1248f3')
			_.set(req, 'params.orderNumber', '20102208083913')
			// 
			// set-default-for-test-ins
			// _.set(req, 'user.id', '107')
			// _.set(req, 'user.csmember_id', '5a1443ff-8824-4656-9b45-89767b1248f3')
			// _.set(req, 'params.orderNumber', '23')

			console.log('query :: ', req.user.csmember_id)
			console.log('payment_type :: ', req.query.payment_type)
			console.log('req.user.id :: ', req.user.id)

			// insurance
			const _fetchOrderInsurance = await modelOrderInsurance.getInsuranceById(req, join)

			// TODO INSURANCE HAVE DATA
			if (_fetchOrderInsurance) {
				const _fetchDetailOrder = await modelOrderInsurance.getInsuranceDetail(req)
				mapDetailOrder = global.helper.web.order_insurance._map_order_insurance(_fetchDetailOrder, req.locale)
				// TODO INSURANCE TYPE ACT ADD ACT_BARCODE
				if (_fetchDetailOrder.type === 'act') {
					const invoice_no = _fetchDetailOrder.invoice.invoice_no
					let modelResult = await modelInsuranceInquiryLog.where('invoice_no', '=', invoice_no).fetch()
					if (!_.isEmpty(modelResult)) {
						let jsonResult = JSON.parse(modelResult.toJSON().res_body)
						mapDetailOrder.act_barcode = '80997' + jsonResult.hq_response.data.tx_id
					}
				}

				// TODO GET PATMENT
				const payment = await global.helper.cms.deal._get_payment({
					invoice_number: mapDetailOrder.invoice.invoice_no,
					payment_method: mapDetailOrder.invoice.payment_type,
					amt: mapDetailOrder.invoice.paid
				})
				// TODO MAP ORDER
				const order = {
					actBarcode: _fetchDetailOrder.type == 'act' ? _fetchDetailOrder.act_barcode : '',
					orderNumber: _fetchDetailOrder.uuid,
					dateTimeCreated: _fetchDetailOrder.created_at,
					expiryDateTime: null,
					paymentTypeCode: null,
					totalAmount: _fetchDetailOrder.paid,
					totalAmtAfterInstDiscount: _fetchDetailOrder.paid,
					totalDiscountAmount: null,
					totalPromoCodeAmount: null,
					totalPromotionDiscount: null,
					totalPromoCouponDiscount: null,
					totalShippingFee: null,
					totalShipFeeDiscount: null,
					totalAmountDue: _fetchDetailOrder.paid,
				}
				// TODO MAP ORDER ITERMS
				const orderItems = global.helper.web.order_insurance._map_type_order_insured(mapDetailOrder, req.locale)
				// console.log('orderItemsxxx', mapDetailOrder)
				const deliveryContact = mapDetailOrder.insured[0] || {}
				const deliveryAddress = mapDetailOrder.shipping || {}

				delete mapDetailOrder.insurance
				delete mapDetailOrder.insured
				delete mapDetailOrder.beneficiaries
				delete mapDetailOrder.shipping
				delete mapDetailOrder.answers
				delete payment.data.cspaySignature
				delete payment.data.token

				// TODO MAP DATA INSURANCE
				mapDataInsurance = { ...mapDetailOrder, deliveryContact, deliveryAddress, order: order, orderItems: orderItems, payment: payment.data, type: 'ins' }

				// console.log('mapDataInsurance', mapDataInsurance)
			}

			// deal /account/req.query.account/orders/req.query.orders
			const _fetchOrderDeal = await modelDealOrder.getOrderDealById(req, join)

			// TODO DEAL HAVE DATA
			if (_fetchOrderDeal) {
				const strUrl = `${global.config.deal.endpoint.order}/order/v1/accounts/${req.user.csmember_id}/orders/${req.params.orderNumber}/detail`
				const objOption = {
					headers: {
						'Accept-Language': req.locale
					},
				}
				// TODO GET ORDER-DETAIL
				const orderDetail = await Request.get('apiAllDeal.jsonOrderStatusByIdGet', strUrl, objOption)

				// console.log('order-detail', orderDetail)

				// TODO GET PATMENT
				const payment = await global.helper.cms.deal._get_payment({
					invoice_number: _fetchOrderDeal.invoice.invoice_no,
					payment_method: _fetchOrderDeal.invoice.payment_type,
					amt: _fetchOrderDeal.invoice.paid
				})

				delete payment.data.cspaySignature
				delete payment.data.token

				// TODO MAP DATA DEAL
				mapDataDeal = { ..._fetchOrderDeal, order: _.get(orderDetail, 'data.order', null), orderItems: _.get(orderDetail, 'data.orderItems', null), payment: payment.data, type: 'deal' }

				// console.log('mapDataDeal', mapDataDeal)
			}

			if (mapDataDeal || mapDataInsurance) {
				resData.data = []
				resData.code = 0
				resData.msg = 'successful'
				if (!_.isEmpty(mapDataDeal)) resData.data.push(mapDataDeal)
				if (!_.isEmpty(mapDataInsurance)) resData.data.push(mapDataInsurance)
			}

			return res.json(resData)
		} catch (err) {
			console.error('# Error Controller apiIndex.v2.jsonOrderStatusByIdGet:', err)
			return next(err)
		}
	},

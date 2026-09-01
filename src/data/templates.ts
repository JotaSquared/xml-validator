import { ReferenceTemplate } from '../types';

export const REFERENCE_TEMPLATES: ReferenceTemplate[] = [
  {
    id: 'coupa_contract_backed',
    name: 'Invoice Backed by Contract',
    category: 'CONTRACT',
    description: 'Coupa standard cXML invoice referenced against a contract master agreement number.',
    content: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE cXML SYSTEM "http://xml.cXML.org/schemas/cXML/1.2.020/InvoiceDetail.dtd">
<cXML version="1.0" payloadID="1240598937@SUBDOMAIN.coupahost.com" timestamp="2009-05-01T01:24:51-07:00">
	 <Header>
			<From>
				 <Credential domain="DUNS">
						<Identity>Kyle</Identity>
				 </Credential>
			</From>
			<To>
				 <Credential domain="DUNS">
						<Identity>Coupa</Identity>
				 </Credential>
			</To>
			<Sender>
				 <Credential domain="DUNS">
						<Identity>Kyle</Identity>
						<SharedSecret>Shhh</SharedSecret>
				 </Credential>
				 <UserAgent>Your Very Own Agent 1.23</UserAgent>
			</Sender>
	 </Header>
	 <Request deploymentMode="production">
			<InvoiceDetailRequest>
				 <InvoiceDetailRequestHeader invoiceID="735675n3" purpose="standard" operation="new" invoiceDate="2009-05-01T11:45:51-07:00">
						<InvoiceDetailHeaderIndicator />
						<InvoiceDetailLineIndicator isAccountingInLine="yes" />
						<PaymentTerm payInNumberOfDays="30" />
				 </InvoiceDetailRequestHeader>
				 <InvoiceDetailOrder>
						<InvoiceDetailOrderInfo>
							 <MasterAgreementReference>
									<!-- payloadID is the Contract number -->
									<DocumentReference payloadID="2257" />
							 </MasterAgreementReference>
						</InvoiceDetailOrderInfo>
						<!-- First invoice quantity line. -->
						<InvoiceDetailItem invoiceLineNumber="1" quantity="1">
							 <UnitOfMeasure>EA</UnitOfMeasure>
							 <UnitPrice>
									<Money currency="USD">365</Money>
							 </UnitPrice>
							 <!-- The lineNumber here is the backing PO line number, i.e. in this case, line 2 of PO #10 -->
							 <InvoiceDetailItemReference lineNumber="1">
									<!-- The Description will show up on the invoice's line description. Although it can be anything, 
											 Coupa recommends that you make this the same as the backing PO line's description. -->
									<Description xml:lang="en">NEW 1 NINTENDO WII GAME CONSOLE + WII FIT BUNDLE +GAMES</Description>
							 </InvoiceDetailItemReference>
							 <!-- Shows up as "Total" on the invoice line -->
							 <SubtotalAmount>
									<Money currency="USD">365</Money>
							 </SubtotalAmount>
						</InvoiceDetailItem>
				 </InvoiceDetailOrder>
				 <InvoiceDetailSummary>
						<!-- Should add-up and be consistent with the subtotals on the invoice lines -->
						<SubtotalAmount>
							 <Money currency="USD">365</Money>
						</SubtotalAmount>
						<Tax>
							 <Money currency="USD">8</Money>
							 <Description xml:lang="en">total tax</Description>
							 <TaxDetail purpose="tax" category="VAT" percentageRate="1" taxPointDate="2009-04-24T11:45:51-07:00">
									<TaxableAmount>
										 <Money currency="USD">365</Money>
									</TaxableAmount>
									<TaxAmount>
										 <Money currency="USD">8</Money>
									</TaxAmount>
									<TaxLocation xml:lang="en">CA</TaxLocation>
							 </TaxDetail>
						</Tax>
						<SpecialHandlingAmount>
							 <Money currency="USD">5</Money>
						</SpecialHandlingAmount>
						<!-- Shipping costs -->
						<ShippingAmount>
							 <Money currency="USD">30</Money>
						</ShippingAmount>
						<NetAmount>
							 <Money currency="USD" />
						</NetAmount>
				 </InvoiceDetailSummary>
			</InvoiceDetailRequest>
	 </Request>
</cXML>`
  },
  {
    id: 'coupa_multiple_po',
    name: 'Invoice Backed by Multiple POs',
    category: 'MULTIPLE_PO',
    description: 'Coupa standard cXML invoice backed by multiple Purchase Orders across distinct order sections.',
    content: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE cXML SYSTEM "http://xml.cXML.org/schemas/cXML/1.2.020/InvoiceDetail.dtd">
<cXML payloadID="20101222 190337.2999" timestamp="2010-12-22T19:03:37" version="1.0">
	 <Header>
			<From>
				 <Credential domain="COUPA">
						<Identity>SupplierID</Identity>
				 </Credential>
			</From>
			<To>
				 <Credential domain="COUPA">
						<Identity>BuyerID</Identity>
				 </Credential>
			</To>
			<Sender>
				 <Credential domain="COUPA">
						<Identity>SupplierID</Identity>
						<SharedSecret>123456secret</SharedSecret>
				 </Credential>
				 <UserAgent>Coupa Integration V01</UserAgent>
			</Sender>
	 </Header>
	 <Request deploymentMode="production">
			<InvoiceDetailRequest>
				 <InvoiceDetailRequestHeader invoiceDate="2010-12-16T00:00:00" invoiceID="INV00001" operation="new" purpose="standard">
						<InvoiceDetailHeaderIndicator />
						<InvoiceDetailLineIndicator isAccountingInLine="yes" />
						<PaymentTerm payInNumberOfDays="30" />
				 </InvoiceDetailRequestHeader>
				 <InvoiceDetailOrder>
						<InvoiceDetailOrderInfo>
							 <OrderReference>
									<DocumentReference payloadID="2252" />
							 </OrderReference>
						</InvoiceDetailOrderInfo>
						<InvoiceDetailItem invoiceLineNumber="1" quantity="2.00">
							 <UnitOfMeasure>EA</UnitOfMeasure>
							 <UnitPrice>
									<Money currency="USD">100</Money>
							 </UnitPrice>
							 <InvoiceDetailItemReference lineNumber="1">
									<Description xml:lang="en">Item1</Description>
							 </InvoiceDetailItemReference>
							 <SubtotalAmount>
									<Money currency="USD">200</Money>
							 </SubtotalAmount>
						</InvoiceDetailItem>
				 </InvoiceDetailOrder>
				 <InvoiceDetailOrder>
						<InvoiceDetailOrderInfo>
							 <OrderReference>
									<DocumentReference payloadID="2253" />
							 </OrderReference>
						</InvoiceDetailOrderInfo>
						<InvoiceDetailItem invoiceLineNumber="2" quantity="2">
							 <UnitOfMeasure>EA</UnitOfMeasure>
							 <UnitPrice>
									<Money currency="USD">10</Money>
							 </UnitPrice>
							 <InvoiceDetailItemReference lineNumber="1">
									<Description xml:lang="en">Test Item</Description>
							 </InvoiceDetailItemReference>
							 <SubtotalAmount>
									<Money currency="USD">20</Money>
							 </SubtotalAmount>
						</InvoiceDetailItem>
				 </InvoiceDetailOrder>
				 <InvoiceDetailSummary>
						<SubtotalAmount>
							 <Money currency="USD">220.00</Money>
						</SubtotalAmount>
						<Tax>
							 <Money currency="USD">0</Money>
							 <Description xml:lang="en">TaxStuff</Description>
							 <TaxDetail category="tax" purpose="tax" taxPointDate="2010-12-16T00:00:00">
									<TaxableAmount>
										 <Money currency="USD" />
									</TaxableAmount>
									<TaxAmount>
										 <Money currency="USD">0</Money>
									</TaxAmount>
									<TaxLocation xml:lang="en">CA</TaxLocation>
							 </TaxDetail>
						</Tax>
						<SpecialHandlingAmount>
							 <Money currency="USD">0</Money>
						</SpecialHandlingAmount>
						<ShippingAmount>
							 <Money currency="USD">0</Money>
						</ShippingAmount>
						<NetAmount>
							 <Money currency="USD">0</Money>
						</NetAmount>
				 </InvoiceDetailSummary>
			</InvoiceDetailRequest>
	 </Request>
</cXML>`
  },
  {
    id: 'coupa_payment_terms',
    name: 'Invoice with Payment Terms',
    category: 'PAYMENT_TERMS',
    description: 'Coupa standard cXML invoice with PaymentTerm specifications and discount rules.',
    publisher: 'Coupa',
    sourceType: 'OFFICIAL_DOCUMENTATION',
    sourceTitle: 'Coupa Standard Invoice with Payment Terms',
    sourceUrl: 'https://docs.coupa.com',
    retrievedDate: '2026-08-31',
    comparisonMode: 'STRUCTURE_ONLY',
    documentIntegrity: {
      modifiedFromOfficialSample: true,
      modificationType: 'SYNTAX_CORRECTION',
      modificationDescription: 'Removed one duplicated closing </Street> tag from the official Coupa Payment Terms sample because the published XML was malformed.',
      modifiedDate: '2026-08-31'
    },
    documentNote: 'Local syntax correction applied to the official Coupa sample.',
    content: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE cXML SYSTEM "http://xml.cXML.org/schemas/cXML/1.2/InvoiceDetail.dtd">
<cXML version="1.0" payloadID="xxx.xxxx@example.coupahost.com" timestamp="2014-03-04T12:00:00-00:00">
	<Header>
		<From>
			<Credential domain="DUNS">
				<Identity>xxxxxxxx</Identity>
			</Credential>
		</From>
		<To>
			<Credential domain="NetworkID">
				<Identity>yyyyyyyy</Identity>
			</Credential>
		</To>
		<Sender>
			<Credential domain="DUNS">
				<Identity>xxxxxxxxx</Identity>
				<SharedSecret>xxxxxxxxx</SharedSecret>
			</Credential>
			<UserAgent>Coupa Procurement 1.0</UserAgent>
		</Sender>
	</Header>
	<Request deploymentMode="production">
		<InvoiceDetailRequest>
			<InvoiceDetailRequestHeader invoiceID="900522Mar0314" purpose="standard" 
						operation="new" invoiceDate="2014-03-03T12:00:00-00:00">
				<InvoiceDetailHeaderIndicator/>
				<InvoiceDetailLineIndicator isAccountingInLine="yes"/>
				<InvoicePartner>
					<Contact role="soldTo">
						<Name xml:lang="en-US">COUPA</Name>
						<PostalAddress>
							<Street>													</Street>
							<Street>123 Main St</Street>
							<City>San Mateo</City>
							<State>CA</State>
							<PostalCode>94402</PostalCode>
							<Country isoCountryCode="US">United States</Country>
						</PostalAddress>
					</Contact>
				</InvoicePartner>
				<InvoicePartner>
					<Contact role="billTo" addressID="1057	">
						<Name xml:lang="en-US">COUPA</Name>
						<PostalAddress>
							<Street>123 Main St</Street>
							<City>San Mateo</City>
							<State>CA</State>
							<PostalCode>94402</PostalCode>
							<Country isoCountryCode="US">United States</Country>
						</PostalAddress>
					</Contact>
				</InvoicePartner>
				<PaymentTerm payInNumberofDays="30">
					<Discount>
						<DiscountPercent percent="2" />
						<DiscountDueDays>20</DiscountDueDays>
					</Discount>
					<NetDueDays>30</NetDueDays>
				</PaymentTerm>
			</InvoiceDetailRequestHeader>
			<InvoiceDetailOrder>
				<InvoiceDetailOrderInfo>
					<OrderReference>
						<DocumentReference payloadID="1352"/>
					</OrderReference>
				</InvoiceDetailOrderInfo>
				<InvoiceDetailItem invoiceLineNumber="1" quantity="1">
					<UnitOfMeasure>EA</UnitOfMeasure>
					<UnitPrice>
						<Money currency="USD">12.42</Money>
					</UnitPrice>
					<InvoiceDetailItemReference lineNumber="1">
						<ItemID>
							<SupplierPartID>N189465</SupplierPartID>
						</ItemID>
						<Description xml:lang="en-US">Paper Mate - Profile Retractable Ballpoint Pens - Black, Bold, 12/Pack</Description>
						<ManufacturerPartID>MF4770N		 </ManufacturerPartID>
						<ManufacturerName xml:lang="en-US">CANON </ManufacturerName>
					</InvoiceDetailItemReference>
					<SubtotalAmount>
						<Money currency="USD">12.42</Money>
					</SubtotalAmount>
					<GrossAmount>
						<Money currency="USD">12.42</Money>
					</GrossAmount>
					<NetAmount>
						<Money currency="USD">12.42</Money>
					</NetAmount>
				</InvoiceDetailItem>
			</InvoiceDetailOrder>
			<InvoiceDetailSummary>
				<SubtotalAmount>
					<Money currency="USD">12.42</Money>
				</SubtotalAmount>
				<Tax>
					<Money currency="USD"></Money>
					<Description xml:lang="en-US"/>
					<TaxDetail purpose="tax" category="sales" percentageRate="0">
						<TaxableAmount>
							<Money currency="USD">12.42</Money>
						</TaxableAmount>
						<TaxAmount>
							<Money currency="USD"></Money>
						</TaxAmount>
						<TaxLocation xml:lang="en-US">usa</TaxLocation>
					</TaxDetail>
				</Tax>
				<ShippingAmount>
					<Money currency="USD">.00</Money>
				</ShippingAmount>
				<GrossAmount>
					<Money currency="USD">12.42</Money>
				</GrossAmount>
				<NetAmount>
					<Money currency="USD">12.42</Money>
				</NetAmount>
				<DueAmount>
					<Money currency="USD">12.42</Money>
				</DueAmount>
			</InvoiceDetailSummary>
		</InvoiceDetailRequest>
	</Request>
</cXML>`
  },
  {
    id: 'coupa_custom_fields',
    name: 'Invoice with Custom Fields (Extrinsic)',
    category: 'EXTRINSICS',
    description: 'Coupa standard cXML invoice with Extrinsic CustomFields at both header and line level.',
    content: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE cXML SYSTEM "http://xml.cXML.org/schemas/cXML/1.2.020/InvoiceDetail.dtd">
<cXML version="1.0" payloadID="1240598937@devtrunk.coupahost.com" timestamp="2009-05-04T01:24:51-07:00">
	 <Header>
			<From>
				 <Credential domain="DUNS">
						<Identity>supplierid</Identity>
				 </Credential>
			</From>
			<To>
				 <Credential domain="DUNS">
						<Identity>buyerid</Identity>
				 </Credential>
			</To>
			<Sender>
				 <Credential domain="DUNS">
						<Identity>supplierid</Identity>
						<SharedSecret>secret</SharedSecret>
				 </Credential>
				 <UserAgent>Your Very Own Agent 1.23</UserAgent>
			</Sender>
	 </Header>
	 <Request deploymentMode="production">
			<InvoiceDetailRequest>
				 <InvoiceDetailRequestHeader invoiceID="3492" purpose="standard" operation="new" invoiceDate="2009-05-01T11:45:51-07:00">
						<InvoiceDetailHeaderIndicator />
						<InvoiceDetailLineIndicator isAccountingInLine="yes" />
						<PaymentTerm payInNumberOfDays="30" />
						<!-- Custom field on Invoice Header - field name = "invoice_image_url -->
						<Extrinsic name="CustomFields">
							 <IdReference identifier="invoice_image_url" domain="CustomFields">
									<Description xml:lang="en">http://my.domain.com/invoiceimageurl.jpg</Description>
							 </IdReference>
						</Extrinsic>
				 </InvoiceDetailRequestHeader>
				 <InvoiceDetailOrder>
						<InvoiceDetailOrderInfo>
							 <OrderReference>
									<DocumentReference payloadID="123" />
							 </OrderReference>
						</InvoiceDetailOrderInfo>
						<InvoiceDetailItem invoiceLineNumber="1" quantity="1">
							 <UnitOfMeasure>EA</UnitOfMeasure>
							 <UnitPrice>
									<Money currency="USD">365</Money>
							 </UnitPrice>
							 <InvoiceDetailItemReference lineNumber="1">
									<Description xml:lang="en">NEW 1 NINTENDO WII GAME CONSOLE + WII FIT BUNDLE +GAMES</Description>
							 </InvoiceDetailItemReference>
							 <SubtotalAmount>
									<Money currency="USD">365</Money>
							 </SubtotalAmount>
							 <!-- Custom field on Invoice Line - field name = "line_level_field -->
							 <Extrinsic name="CustomFields">
									<IdReference identifier="line_level_field" domain="CustomField">
										 <Description xml:lang="en">This is a line level field</Description>
									</IdReference>
							 </Extrinsic>
						</InvoiceDetailItem>
				 </InvoiceDetailOrder>
				 <InvoiceDetailSummary>
						<SubtotalAmount>
							 <Money currency="USD">365</Money>
						</SubtotalAmount>
						<Tax>
							 <Money currency="USD">8</Money>
							 <Description xml:lang="en">total tax</Description>
							 <TaxDetail purpose="tax" category="CA" percentageRate="8.25" taxPointDate="2009-04-24T11:45:51-07:00">
									<TaxableAmount>
										 <Money currency="USD">365</Money>
									</TaxableAmount>
									<TaxAmount>
										 <Money currency="USD">8</Money>
									</TaxAmount>
									<TaxLocation xml:lang="en">CA</TaxLocation>
							 </TaxDetail>
						</Tax>
						<SpecialHandlingAmount>
							 <Money currency="USD">5</Money>
						</SpecialHandlingAmount>
						<ShippingAmount>
							 <Money currency="USD">30</Money>
						</ShippingAmount>
						<NetAmount>
							 <Money currency="USD" />
						</NetAmount>
				 </InvoiceDetailSummary>
			</InvoiceDetailRequest>
	 </Request>
</cXML>`
  },
  {
    id: 'coupa_match_reference',
    name: 'Invoice with MatchReference for 3-Way Direct Matching',
    category: 'MATCHING',
    description: 'Coupa standard cXML invoice with MatchReference extrinsic for 3-way direct receipt matching.',
    content: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE cXML SYSTEM "http://xml.cXML.org/schemas/cXML/1.2.020/InvoiceDetail.dtd">
<cXML version="1.2.033" payloadID="frieslandcampina-dev.coupahost.com" timestamp="2017-04-20T16:29:14+00:00">
   <Header>
      <From>
         <Credential domain="987654">
            <Identity>987654</Identity>
            <SharedSecret>987654</SharedSecret>
         </Credential>
      </From>
      <To>
         <Credential domain="987654">
            <Identity>987654</Identity>
         </Credential>
      </To>
      <Sender>
         <Credential domain="987654">
            <Identity>987654</Identity>
            <SharedSecret>987654</SharedSecret>
         </Credential>
         <UserAgent>Your Very Own Agent 1.23</UserAgent>
      </Sender>
   </Header>
   <Request deploymentMode="production">
      <InvoiceDetailRequest>
         <InvoiceDetailRequestHeader invoiceID="AZ_15" purpose="standard" operation="new"
         invoiceDate="2015-04-30T11:45:51-07:00">
            <InvoiceDetailHeaderIndicator />
            <InvoiceDetailLineIndicator isAccountingInLine="yes" />
            <PaymentTerm payInNumberOfDays="30" />
         </InvoiceDetailRequestHeader>
         <InvoiceDetailOrder>
            <InvoiceDetailOrderInfo>
               <OrderReference>
                  <DocumentReference payloadID="ADAMZ_PO_3way_004" />
               </OrderReference>
               <SupplierOrderInfo orderID="ADAMZ_PO_3way_004" />
            </InvoiceDetailOrderInfo>
            <!-- First invoice quantity line. -->
            <InvoiceDetailItem invoiceLineNumber="1" quantity="1">
               <UnitOfMeasure>EA</UnitOfMeasure>
               <UnitPrice>
                  <Money currency="USD">16.2</Money>
               </UnitPrice>
               <InvoiceDetailItemReference lineNumber="1">
                  <Description xml:lang="en">The Red Swingline Staplert</Description>
               </InvoiceDetailItemReference>
               <SubtotalAmount>
                  <Money currency="USD">16.2</Money>
               </SubtotalAmount>
               <Extrinsic name="MatchReference">ADAMCXML1</Extrinsic>
            </InvoiceDetailItem>
         </InvoiceDetailOrder>
         <InvoiceDetailSummary>
            <SubtotalAmount>
               <Money currency="USD">16.2</Money>
            </SubtotalAmount>
            <Tax>
               <Money currency="USD" alternateAmount="0" alternateCurrency="EUR">0</Money>
               <Description xml:lang="en">total tax</Description>
               <TaxDetail purpose="tax" category="Standard Rate" percentageRate="0"
               taxPointDate="2014-06-30T11:45:51-07:00">
                  <TaxableAmount>
                     <Money currency="USD">16.2</Money>
                  </TaxableAmount>
                  <TaxAmount>
                     <Money currency="USD">0</Money>
                  </TaxAmount>
                  <TaxLocation xml:lang="en" />
               </TaxDetail>
            </Tax>
            <NetAmount>
               <Money currency="USD" />
            </NetAmount>
         </InvoiceDetailSummary>
      </InvoiceDetailRequest>
   </Request>
</cXML>`
  },
  {
    id: 'coupa_service_invoice',
    name: 'Service Type Invoice',
    category: 'SERVICE',
    description: 'Coupa standard cXML invoice with service line items (InvoiceDetailServiceItem) and unit of measure HUR.',
    content: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE cXML SYSTEM "http://xml.cXML.org/schemas/cXML/1.2.008/InvoiceDetail.dtd">
<cXML version="1.1.008" payloadID="201404091618341618340.106@coupa.com" timestamp="2014-04-09T16:18:34-07:00">
	 <Header>
			<From>
				 <Credential domain="NetworkID">
						<Identity>TEST</Identity>
						<SharedSecret>InvoicePROD</SharedSecret>
				 </Credential>
			</From>
			<To>
				 <Credential domain="NetworkID">
						<Identity>TEST</Identity>
				 </Credential>
			</To>
			<Sender>
				 <Credential domain="NetworkID">
						<Identity>TEST</Identity>
						<SharedSecret>InvoicePROD</SharedSecret>
				 </Credential>
				 <UserAgent>CatalogManager</UserAgent>
			</Sender>
	 </Header>
	 <Request deploymentMode="production">
			<InvoiceDetailRequest>
				 <InvoiceDetailRequestHeader invoiceID="2650" invoiceDate="2014-04-04T00:00:00-07:00" operation="new" purpose="standard">
						<InvoiceDetailHeaderIndicator />
						<InvoiceDetailLineIndicator isAccountingInLine="yes" />
						<InvoiceDetailPaymentTerm payInNumberOfDays="030" percentageRate="000000" />
				 </InvoiceDetailRequestHeader>
				 <InvoiceDetailOrder>
						<InvoiceDetailOrderInfo>
							 <OrderReference>
									<DocumentReference payloadID="10050" />
							 </OrderReference>
						</InvoiceDetailOrderInfo>
						<InvoiceDetailServiceItem invoiceLineNumber="00001" quantity="1">
							 <InvoiceDetailServiceItemReference lineNumber="00001" />
							 <SubtotalAmount>
									<Money currency="USD">501.36</Money>
							 </SubtotalAmount>
							 <UnitOfMeasure>HUR</UnitOfMeasure>
							 <UnitPrice>
									<Money currency="USD">501.36</Money>
							 </UnitPrice>
						</InvoiceDetailServiceItem>
				 </InvoiceDetailOrder>
				 <InvoiceDetailSummary>
						<SubtotalAmount>
							 <Money currency="USD">501.36</Money>
						</SubtotalAmount>
						<Tax>
							 <Money currency="USD">0</Money>
							 <Description xml:lang="en">Total Tax Invoice</Description>
							 <TaxDetail purpose="tax" category="sales">
									<TaxableAmount>
										 <Money currency="USD">501.36</Money>
									</TaxableAmount>
									<TaxAmount>
										 <Money currency="USD">0</Money>
									</TaxAmount>
							 </TaxDetail>
						</Tax>
						<GrossAmount>
							 <Money currency="USD">501.36</Money>
						</GrossAmount>
						<NetAmount>
							 <Money currency="USD">501.36</Money>
						</NetAmount>
						<DueAmount>
							 <Money currency="USD">501.36</Money>
						</DueAmount>
				 </InvoiceDetailSummary>
			</InvoiceDetailRequest>
	 </Request>
</cXML>`
  },
  {
    id: 'coupa_billing_distributions',
    name: 'Invoice with Billing Account Distributions',
    category: 'ACCOUNTING',
    description: 'Coupa standard cXML invoice with accounting segments and charge distributions at line level.',
    content: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE cXML SYSTEM "http://xml.cXML.org/schemas/cXML/1.2.020/InvoiceDetail.dtd">
<cXML version="1.0" payloadID="1240598937@SUBDOMAIN.coupahost.com" timestamp="2009-05-01T01:24:51-07:00">
	 <Header>
			<From>
				 <Credential domain="DUNS">
						<Identity>Kyle</Identity>
				 </Credential>
			</From>
			<To>
				 <Credential domain="DUNS">
						<Identity>Coupa</Identity>
				 </Credential>
			</To>
			<Sender>
				 <Credential domain="DUNS">
						<Identity>Kyle</Identity>
						<SharedSecret>Shhh</SharedSecret>
				 </Credential>
				 <UserAgent>Your Very Own Agent 1.23</UserAgent>
			</Sender>
	 </Header>
	 <Request deploymentMode="production">
			<InvoiceDetailRequest>
				 <InvoiceDetailRequestHeader invoiceID="735675n3" purpose="standard" operation="new"
						invoiceDate="2009-05-01T11:45:51-07:00">
						<InvoiceDetailHeaderIndicator />
						<InvoiceDetailLineIndicator isAccountingInLine="yes" />
						<PaymentTerm payInNumberOfDays="30" />
				 </InvoiceDetailRequestHeader>
				 <InvoiceDetailOrder>
						<InvoiceDetailOrderInfo>
							 <MasterAgreementReference>
									<!-- payloadID is the Contract number -->
									<DocumentReference payloadID="2257" />
							 </MasterAgreementReference>
						</InvoiceDetailOrderInfo>
						<!-- First invoice quantity line. -->
						<InvoiceDetailItem invoiceLineNumber="1" quantity="1">
							 <UnitOfMeasure>EA</UnitOfMeasure>
							 <UnitPrice>
									<Money currency="USD">365</Money>
							 </UnitPrice>
							 <!-- The lineNumber here is the backing PO line number, i.e. in this case, line 2 of PO #10 -->
							 <InvoiceDetailItemReference lineNumber="1">
									<!-- The Description will show up on the invoice's line description. Although it can be 
									anything, Coupa recommends that you make this the same as the backing PO line's description. -->
									<Description xml:lang="en">NEW 1 NINTENDO WII GAME CONSOLE + WII FIT BUNDLE +GAMES</Description>
							 </InvoiceDetailItemReference>
							 <!-- Shows up as "Total" on the invoice line -->
							 <SubtotalAmount>
									<Money currency="USD">365</Money>
							 </SubtotalAmount>
							 <!-- Billing Account segments.	-->
							 <Distribution>
									<Accounting name="Chart of Accounts">
										 <!-- id value represents the segment in Coupa -->
										 <AccountingSegment>
												<Name xml:lang="en">Purchase</Name>
												<Description xml:lang="en">Production Control</Description>
										 </AccountingSegment>
										 <AccountingSegment id="IT">
												<Name xml:lang="en">Seg Name</Name>
												<Description xml:lang="en">Seg Code</Description>
										 </AccountingSegment>
									</Accounting>
									<Charge>
										 <Money currency="USD">100</Money>
									</Charge>
							 </Distribution>
							 <Distribution>
									<Accounting name="Buyer assigned accounting code 2">
										 <AccountingSegment id="ABC000000001">
												<Name xml:lang="en">Trade</Name>
												<Description xml:lang="en">Misc (Expensed)</Description>
										 </AccountingSegment>
									</Accounting>
									<Charge>
										 <Money currency="USD">245</Money>
									</Charge>
							 </Distribution>
						</InvoiceDetailItem>
				 </InvoiceDetailOrder>
				 <InvoiceDetailSummary>
						<!-- Should add-up and be consistent with the subtotals on the invoice lines -->
						<SubtotalAmount>
							 <Money currency="USD">365</Money>
						</SubtotalAmount>
						<Tax>
							 <Money currency="USD">8</Money>
							 <Description xml:lang="en">total tax</Description>
							 <TaxDetail purpose="tax" category="VAT" percentageRate="1" taxPointDate="2009-04-24T11:45:51-07:00">
									<TaxableAmount>
										 <Money currency="USD">365</Money>
									</TaxableAmount>
									<TaxAmount>
										 <Money currency="USD">8</Money>
									</TaxAmount>
									<TaxLocation xml:lang="en">CA</TaxLocation>
							 </TaxDetail>
						</Tax>
						<SpecialHandlingAmount>
							 <Money currency="USD">5</Money>
						</SpecialHandlingAmount>
						<!-- Shipping costs -->
						<ShippingAmount>
							 <Money currency="USD">30</Money>
						</ShippingAmount>
						<NetAmount>
							 <Money currency="USD" />
						</NetAmount>
				 </InvoiceDetailSummary>
			</InvoiceDetailRequest>
	 </Request>
</cXML>`
  }
];

export const SAMPLE_MALFORMED_XML = `<?xml version="1.0" encoding="UTF-8"?>
<cXML version="1.2.020" payloadID="sample-malformed@test.com">
  <Header>
    <From>
      <Credential domain="NetworkID">
        <Identity>SUPPLIER-001</Identity>
      <!-- Error: unclosed tag or mismatch -->
    </From>
  </Header>
  <Request>
    <InvoiceDetailRequest>
      <InvoiceDetailRequestHeader invoiceID="INV-ERR-001" invoiceDate="2023/10/24">
        <InvoicePartner>
          <Contact role="remitTo">
            <Name>Broken Invoice LLC</Name>
          </Contact>
        </InvoicePartner>
      </InvoiceDetailRequestHeader>
    </InvoiceDetailRequest>
  </Request>
</cXML>`;


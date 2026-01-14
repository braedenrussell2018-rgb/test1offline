import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, Check, Share2, FileText, Shield, AlertTriangle, BookOpen, Lock, Database } from "lucide-react";
import { toast } from "sonner";

const Legal = () => {
  const [copied, setCopied] = useState(false);
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy link");
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Serial Stock Suite - Legal & Security Documents',
          text: 'Legal and Security Policy Documents',
          url: shareUrl,
        });
      } catch (err) {
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  };

  const handleDownloadPolicy = (policyName: string) => {
    const policyFiles: Record<string, string> = {
      'Information Security': '/docs/INFORMATION-SECURITY-POLICY.md',
      'Acceptable Use': '/docs/ACCEPTABLE-USE-POLICY.md',
      'Incident Response': '/docs/INCIDENT-RESPONSE-POLICY.md',
      'Data Handling': '/docs/DATA-HANDLING-POLICY.md',
      'Access Control': '/docs/SOC2-ACCESS-CONTROL.md',
      'Data Flow': '/docs/SOC2-DATA-FLOW.md',
      'Encryption': '/docs/SOC2-ENCRYPTION.md',
      'Logging & Monitoring': '/docs/SOC2-LOGGING-MONITORING.md',
    };
    
    const filePath = policyFiles[policyName];
    if (filePath) {
      window.open(filePath, '_blank');
      toast.success(`Opening ${policyName} Policy`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Serial Stock Suite</h1>
          <p className="text-muted-foreground">Legal & Security Documents</p>
        </div>

        <Tabs defaultValue="eula" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="eula" className="flex items-center gap-1 text-xs sm:text-sm">
              <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">EULA</span>
              <span className="sm:hidden">EULA</span>
            </TabsTrigger>
            <TabsTrigger value="privacy" className="flex items-center gap-1 text-xs sm:text-sm">
              <Shield className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Privacy</span>
              <span className="sm:hidden">Privacy</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-1 text-xs sm:text-sm">
              <Lock className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Security</span>
              <span className="sm:hidden">Security</span>
            </TabsTrigger>
            <TabsTrigger value="compliance" className="flex items-center gap-1 text-xs sm:text-sm">
              <BookOpen className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">SOC 2</span>
              <span className="sm:hidden">SOC 2</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="eula">
            <Card>
              <CardHeader>
                <CardTitle>End-User License Agreement (EULA)</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[60vh] pr-4">
                  <div className="prose prose-sm dark:prose-invert max-w-none space-y-4">
                    <p className="text-sm text-muted-foreground">Last Updated: January 8, 2026</p>
                    
                    <div className="bg-muted/50 p-4 rounded-lg border">
                      <p className="font-semibold">IMPORTANT – READ CAREFULLY</p>
                      <p className="mt-2 text-sm">
                        This End-User License Agreement ("Agreement" or "EULA") is a legal agreement between you ("User," "you," or "your") and [Your Company Name] ("Company," "we," "us," or "our") governing your use of Serial Stock Suite, including all associated software, applications, updates, and documentation (collectively, the "Software").
                      </p>
                      <p className="mt-2 text-sm">
                        BY INSTALLING, COPYING, OR OTHERWISE USING THE SOFTWARE, YOU ACKNOWLEDGE THAT YOU HAVE READ, UNDERSTOOD, AND AGREE TO BE BOUND BY THE TERMS AND CONDITIONS OF THIS AGREEMENT. IF YOU DO NOT AGREE TO THESE TERMS, DO NOT INSTALL OR USE THE SOFTWARE.
                      </p>
                      <p className="mt-2 text-sm">
                        IF YOU ARE ACCEPTING THESE TERMS ON BEHALF OF A COMPANY OR OTHER LEGAL ENTITY, YOU REPRESENT THAT YOU HAVE THE AUTHORITY TO BIND SUCH ENTITY TO THESE TERMS.
                      </p>
                    </div>

                    <h2 className="text-lg font-semibold mt-6">1. DEFINITIONS</h2>
                    <p><strong>1.1 "Authorized Users"</strong> means individuals who have been granted access to the Software under your subscription, including employees, owners, customers, and salesmen as designated through the role-based access control system.</p>
                    <p><strong>1.2 "Company Data"</strong> means all data, information, content, and materials that you or your Authorized Users input, upload, store, or process through the Software, including but not limited to customer information, inventory data, invoices, financial records, vendor information, and conversation transcripts.</p>
                    <p><strong>1.3 "Services"</strong> means the cloud-based services, synchronization features, AI assistance capabilities, and third-party integrations provided through the Software.</p>
                    <p><strong>1.4 "Subscription"</strong> means the period during which you have paid for and are authorized to use the Software and Services.</p>

                    <h2 className="text-lg font-semibold mt-6">2. LICENSE GRANT</h2>
                    <p><strong>2.1 Grant of License.</strong> Subject to the terms of this Agreement and payment of applicable fees, the Company grants you a limited, non-exclusive, non-transferable, revocable license to:</p>
                    <ul className="list-disc pl-6 space-y-1">
                      <li>(a) Install and use the Software on devices owned or controlled by you or your organization;</li>
                      <li>(b) Allow your Authorized Users to access and use the Software in accordance with their assigned roles;</li>
                      <li>(c) Use the multi-device synchronization features to access Company Data across authorized devices;</li>
                      <li>(d) Utilize the AI assistance features for analyzing conversation transcripts and business data;</li>
                      <li>(e) Integrate the Software with approved third-party services, including QuickBooks Online.</li>
                    </ul>
                    <p><strong>2.2 Scope of Use.</strong> This license permits you to use the Software for your internal business operations, including:</p>
                    <ul className="list-disc pl-6 space-y-1">
                      <li>Inventory management and tracking</li>
                      <li>Customer relationship management (CRM)</li>
                      <li>Invoice and estimate generation</li>
                      <li>Purchase order management</li>
                      <li>Expense tracking and budget forecasting</li>
                      <li>Vendor management</li>
                      <li>Sales performance tracking (SPIFF program)</li>
                      <li>Multi-device data synchronization</li>
                    </ul>

                    <h2 className="text-lg font-semibold mt-6">3. LICENSE RESTRICTIONS</h2>
                    <p><strong>3.1 Prohibited Activities.</strong> You shall NOT:</p>
                    <ul className="list-disc pl-6 space-y-1">
                      <li>(a) Copy, modify, adapt, translate, reverse engineer, decompile, disassemble, or create derivative works based on the Software;</li>
                      <li>(b) Sublicense, lease, rent, loan, sell, distribute, or otherwise transfer the Software to any third party;</li>
                      <li>(c) Remove, alter, or obscure any proprietary notices, labels, or marks on the Software;</li>
                      <li>(d) Use the Software to process data for third parties on a service bureau, time-sharing, or similar basis;</li>
                      <li>(e) Attempt to gain unauthorized access to the Software, other users' accounts, or related systems or networks;</li>
                      <li>(f) Use the Software in any manner that violates applicable laws, regulations, or third-party rights;</li>
                      <li>(g) Interfere with or disrupt the integrity or performance of the Software or Services;</li>
                      <li>(h) Circumvent, disable, or otherwise interfere with security-related features, including role-based access controls and Row-Level Security (RLS);</li>
                      <li>(i) Use automated scripts, bots, or other means to access the Software in violation of this Agreement;</li>
                      <li>(j) Share login credentials or allow unauthorized persons to access the Software under your account.</li>
                    </ul>
                    <p><strong>3.2 User Role Compliance.</strong> You agree to:</p>
                    <ul className="list-disc pl-6 space-y-1">
                      <li>(a) Assign appropriate roles (owner, employee, customer, salesman) to Authorized Users based on their legitimate business needs;</li>
                      <li>(b) Regularly review and update user access permissions;</li>
                      <li>(c) Immediately revoke access for users who no longer require it;</li>
                      <li>(d) Ensure that users with "owner" privileges understand and accept responsibility for administrative functions.</li>
                    </ul>

                    <h2 className="text-lg font-semibold mt-6">4. DATA OWNERSHIP AND RIGHTS</h2>
                    <p><strong>4.1 Your Data.</strong> You retain all ownership rights to your Company Data. The Company does not claim ownership of any data you input into the Software.</p>
                    <p><strong>4.2 License to Company Data.</strong> You grant us a limited, non-exclusive license to access, process, store, and transmit your Company Data solely to:</p>
                    <ul className="list-disc pl-6 space-y-1">
                      <li>(a) Provide and maintain the Software and Services;</li>
                      <li>(b) Enable synchronization across your authorized devices;</li>
                      <li>(c) Process data through AI features as requested by you;</li>
                      <li>(d) Generate backups and ensure data integrity;</li>
                      <li>(e) Comply with legal obligations.</li>
                    </ul>
                    <p><strong>4.3 Data Portability.</strong> You may export your Company Data at any time in standard formats. Upon termination of your Subscription, you will have a grace period of thirty (30) days to export your data before it is scheduled for deletion.</p>
                    <p><strong>4.4 Aggregated Data.</strong> We may collect and analyze anonymized, aggregated data derived from your use of the Software for purposes of improving our products and services. Such aggregated data will not identify you or your organization.</p>

                    <h2 className="text-lg font-semibold mt-6">5. THIRD-PARTY INTEGRATIONS</h2>
                    <p><strong>5.1 QuickBooks Online Integration.</strong> If you choose to integrate the Software with QuickBooks Online:</p>
                    <ul className="list-disc pl-6 space-y-1">
                      <li>(a) You authorize us to exchange data with QuickBooks Online on your behalf;</li>
                      <li>(b) You are responsible for maintaining valid QuickBooks Online credentials;</li>
                      <li>(c) Your use of QuickBooks Online is governed by Intuit's terms of service;</li>
                      <li>(d) We are not responsible for any issues arising from QuickBooks Online's availability or functionality.</li>
                    </ul>
                    <p><strong>5.2 AI Services.</strong> The Software utilizes AI-powered features for transcript analysis and business insights:</p>
                    <ul className="list-disc pl-6 space-y-1">
                      <li>(a) AI-processed data is handled in accordance with our Privacy Policy;</li>
                      <li>(b) AI outputs are provided for informational purposes and should not be considered professional advice;</li>
                      <li>(c) You acknowledge that AI features may not be 100% accurate and should be verified before relying on them.</li>
                    </ul>
                    <p><strong>5.3 Third-Party Terms.</strong> Your use of any third-party integrations is subject to those third parties' terms and conditions. We are not responsible for the availability, accuracy, or reliability of third-party services.</p>

                    <h2 className="text-lg font-semibold mt-6">6. SUBSCRIPTION AND PAYMENT</h2>
                    <p><strong>6.1 Subscription Plans.</strong> Access to the Software requires an active Subscription. Available plans and pricing are described on our website and may be updated from time to time.</p>
                    <p><strong>6.2 Payment Terms.</strong> You agree to pay all applicable fees in accordance with the billing terms in effect at the time of purchase. All fees are non-refundable except as expressly stated in this Agreement.</p>
                    <p><strong>6.3 Subscription Renewal.</strong> Your Subscription will automatically renew for successive periods unless you cancel before the renewal date. You authorize us to charge the applicable fee to your payment method on file.</p>
                    <p><strong>6.4 Fee Changes.</strong> We may modify our fees upon thirty (30) days' notice. Continued use of the Software after fee changes take effect constitutes acceptance of the new fees.</p>

                    <h2 className="text-lg font-semibold mt-6">7. SUPPORT AND UPDATES</h2>
                    <p><strong>7.1 Technical Support.</strong> During your Subscription, you are entitled to receive technical support in accordance with the support terms associated with your plan.</p>
                    <p><strong>7.2 Updates.</strong> We may provide updates, patches, bug fixes, or new features to the Software from time to time. Some updates may be automatically installed. You agree that we have no obligation to provide any specific updates or maintain backward compatibility.</p>
                    <p><strong>7.3 Maintenance.</strong> We may perform scheduled or emergency maintenance that temporarily affects Software availability. We will endeavor to provide advance notice of scheduled maintenance when practicable.</p>

                    <h2 className="text-lg font-semibold mt-6">8. SECURITY</h2>
                    <p><strong>8.1 Security Measures.</strong> We implement industry-standard security measures, including:</p>
                    <ul className="list-disc pl-6 space-y-1">
                      <li>(a) User authentication and authorization;</li>
                      <li>(b) Role-based access controls (owner, employee, customer, salesman);</li>
                      <li>(c) Row-Level Security (RLS) at the database level;</li>
                      <li>(d) Encrypted data transmission;</li>
                      <li>(e) Secure device registration and synchronization.</li>
                    </ul>
                    <p><strong>8.2 Your Responsibilities.</strong> You are responsible for:</p>
                    <ul className="list-disc pl-6 space-y-1">
                      <li>(a) Maintaining the confidentiality of your account credentials;</li>
                      <li>(b) All activities that occur under your account;</li>
                      <li>(c) Promptly notifying us of any unauthorized access or security breach;</li>
                      <li>(d) Ensuring your devices meet minimum security requirements;</li>
                      <li>(e) Properly configuring user roles and permissions.</li>
                    </ul>
                    <p><strong>8.3 No Guarantee.</strong> While we strive to maintain strong security, no system is completely secure. We do not guarantee that unauthorized access, hacking, data loss, or other breaches will never occur.</p>

                    <h2 className="text-lg font-semibold mt-6">9. INTELLECTUAL PROPERTY</h2>
                    <p><strong>9.1 Ownership.</strong> The Software, including all intellectual property rights therein, is and shall remain the exclusive property of the Company. This Agreement does not convey any ownership interest in or to the Software.</p>
                    <p><strong>9.2 Trademarks.</strong> "Serial Stock Suite" and associated logos are trademarks of the Company. You may not use these trademarks without our prior written consent.</p>
                    <p><strong>9.3 Feedback.</strong> If you provide us with any feedback, suggestions, or ideas regarding the Software, you grant us a royalty-free, worldwide, perpetual, irrevocable license to use, modify, and incorporate such feedback into our products and services.</p>

                    <h2 className="text-lg font-semibold mt-6">10. CONFIDENTIALITY</h2>
                    <p><strong>10.1 Definition.</strong> "Confidential Information" means any non-public information disclosed by either party, including business information, technical data, trade secrets, and Company Data.</p>
                    <p><strong>10.2 Obligations.</strong> Each party agrees to:</p>
                    <ul className="list-disc pl-6 space-y-1">
                      <li>(a) Protect the other party's Confidential Information using at least the same degree of care used to protect its own confidential information;</li>
                      <li>(b) Not disclose Confidential Information to third parties without prior written consent;</li>
                      <li>(c) Use Confidential Information only for purposes of this Agreement.</li>
                    </ul>
                    <p><strong>10.3 Exceptions.</strong> Confidential Information does not include information that: (a) is or becomes publicly available through no fault of the receiving party; (b) was known to the receiving party prior to disclosure; (c) is independently developed by the receiving party; or (d) is rightfully obtained from a third party.</p>

                    <h2 className="text-lg font-semibold mt-6">11. DISCLAIMER OF WARRANTIES</h2>
                    <p><strong>11.1 AS-IS Basis.</strong> THE SOFTWARE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED.</p>
                    <p><strong>11.2 No Warranty.</strong> TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE COMPANY DISCLAIMS ALL WARRANTIES, INCLUDING BUT NOT LIMITED TO:</p>
                    <ul className="list-disc pl-6 space-y-1">
                      <li>(a) IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT;</li>
                      <li>(b) WARRANTIES THAT THE SOFTWARE WILL BE UNINTERRUPTED, ERROR-FREE, SECURE, OR FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS;</li>
                      <li>(c) WARRANTIES REGARDING THE ACCURACY, RELIABILITY, OR COMPLETENESS OF ANY DATA OR AI-GENERATED OUTPUTS;</li>
                      <li>(d) WARRANTIES REGARDING THIRD-PARTY INTEGRATIONS.</li>
                    </ul>
                    <p><strong>11.3 Beta Features.</strong> Any features identified as "beta" or "preview" are provided without any warranty and may be modified or discontinued at any time.</p>

                    <h2 className="text-lg font-semibold mt-6">12. LIMITATION OF LIABILITY</h2>
                    <p><strong>12.1 Exclusion of Damages.</strong> TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL THE COMPANY BE LIABLE FOR ANY:</p>
                    <ul className="list-disc pl-6 space-y-1">
                      <li>(a) INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES;</li>
                      <li>(b) LOSS OF PROFITS, REVENUE, DATA, BUSINESS OPPORTUNITIES, OR GOODWILL;</li>
                      <li>(c) DAMAGES ARISING FROM YOUR USE OF OR INABILITY TO USE THE SOFTWARE;</li>
                      <li>(d) DAMAGES ARISING FROM UNAUTHORIZED ACCESS TO OR ALTERATION OF YOUR DATA;</li>
                      <li>(e) DAMAGES ARISING FROM THIRD-PARTY CONDUCT OR CONTENT.</li>
                    </ul>
                    <p><strong>12.2 Cap on Liability.</strong> THE COMPANY'S TOTAL CUMULATIVE LIABILITY UNDER THIS AGREEMENT SHALL NOT EXCEED THE GREATER OF: (A) THE AMOUNTS PAID BY YOU FOR THE SOFTWARE IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM; OR (B) ONE HUNDRED DOLLARS ($100).</p>
                    <p><strong>12.3 Essential Purpose.</strong> THE LIMITATIONS IN THIS SECTION SHALL APPLY EVEN IF ANY LIMITED REMEDY FAILS OF ITS ESSENTIAL PURPOSE AND REGARDLESS OF THE THEORY OF LIABILITY.</p>
                    <p><strong>12.4 Jurisdictional Limitations.</strong> SOME JURISDICTIONS DO NOT ALLOW THE EXCLUSION OR LIMITATION OF CERTAIN DAMAGES. IN SUCH JURISDICTIONS, OUR LIABILITY IS LIMITED TO THE MAXIMUM EXTENT PERMITTED BY LAW.</p>

                    <h2 className="text-lg font-semibold mt-6">13. INDEMNIFICATION</h2>
                    <p><strong>13.1 Your Indemnification.</strong> You agree to indemnify, defend, and hold harmless the Company and its officers, directors, employees, agents, and affiliates from and against any claims, damages, losses, liabilities, costs, and expenses (including reasonable attorneys' fees) arising from:</p>
                    <ul className="list-disc pl-6 space-y-1">
                      <li>(a) Your use of the Software;</li>
                      <li>(b) Your violation of this Agreement;</li>
                      <li>(c) Your violation of any applicable law or regulation;</li>
                      <li>(d) Your violation of any third-party rights;</li>
                      <li>(e) Your Company Data or content you provide through the Software.</li>
                    </ul>

                    <h2 className="text-lg font-semibold mt-6">14. TERM AND TERMINATION</h2>
                    <p><strong>14.1 Term.</strong> This Agreement is effective upon your acceptance and continues until terminated.</p>
                    <p><strong>14.2 Termination by You.</strong> You may terminate this Agreement at any time by discontinuing use of the Software and canceling your Subscription.</p>
                    <p><strong>14.3 Termination by Us.</strong> We may terminate or suspend your access to the Software:</p>
                    <ul className="list-disc pl-6 space-y-1">
                      <li>(a) Immediately if you breach any provision of this Agreement;</li>
                      <li>(b) Immediately if required by law or to prevent harm;</li>
                      <li>(c) Upon thirty (30) days' notice for any reason;</li>
                      <li>(d) Immediately if you fail to pay applicable fees.</li>
                    </ul>
                    <p><strong>14.4 Effect of Termination.</strong> Upon termination:</p>
                    <ul className="list-disc pl-6 space-y-1">
                      <li>(a) Your license to use the Software immediately ceases;</li>
                      <li>(b) You must cease all use of the Software and delete all copies;</li>
                      <li>(c) You will have thirty (30) days to export your Company Data;</li>
                      <li>(d) Sections 4, 9, 10, 11, 12, 13, and 15-18 survive termination.</li>
                    </ul>

                    <h2 className="text-lg font-semibold mt-6">15. GOVERNING LAW AND DISPUTE RESOLUTION</h2>
                    <p><strong>15.1 Governing Law.</strong> This Agreement shall be governed by and construed in accordance with the laws of [Your State/Country], without regard to conflict of laws principles.</p>
                    <p><strong>15.2 Dispute Resolution.</strong> Any dispute arising from this Agreement shall be resolved through:</p>
                    <ul className="list-disc pl-6 space-y-1">
                      <li>(a) Good faith negotiation between the parties;</li>
                      <li>(b) If negotiation fails, binding arbitration in accordance with [Arbitration Association] rules;</li>
                      <li>(c) The prevailing party shall be entitled to recover reasonable attorneys' fees.</li>
                    </ul>
                    <p><strong>15.3 Class Action Waiver.</strong> YOU AGREE TO RESOLVE DISPUTES ON AN INDIVIDUAL BASIS AND WAIVE ANY RIGHT TO PARTICIPATE IN A CLASS ACTION LAWSUIT OR CLASS-WIDE ARBITRATION.</p>
                    <p><strong>15.4 Venue.</strong> For any matters not subject to arbitration, you consent to exclusive jurisdiction and venue in the courts located in [Your City, State/Country].</p>

                    <h2 className="text-lg font-semibold mt-6">16. EXPORT COMPLIANCE</h2>
                    <p>You represent that you are not located in, under the control of, or a national or resident of any country to which the United States or other applicable jurisdiction has embargoed goods or services. You agree to comply with all applicable export laws and regulations.</p>

                    <h2 className="text-lg font-semibold mt-6">17. GENERAL PROVISIONS</h2>
                    <p><strong>17.1 Entire Agreement.</strong> This Agreement, together with our Privacy Policy, constitutes the entire agreement between you and the Company regarding the Software and supersedes all prior agreements.</p>
                    <p><strong>17.2 Amendment.</strong> We may modify this Agreement at any time by posting the revised terms on our website or within the Software. Your continued use after such posting constitutes acceptance of the modified terms.</p>
                    <p><strong>17.3 Severability.</strong> If any provision of this Agreement is found to be unenforceable, the remaining provisions shall continue in full force and effect.</p>
                    <p><strong>17.4 Waiver.</strong> Our failure to enforce any right or provision of this Agreement shall not constitute a waiver of such right or provision.</p>
                    <p><strong>17.5 Assignment.</strong> You may not assign or transfer this Agreement without our prior written consent. We may assign this Agreement in connection with a merger, acquisition, or sale of assets.</p>
                    <p><strong>17.6 Notices.</strong> We may provide notices to you via email, in-app notification, or posting on our website. You may provide notices to us at [Contact Email Address].</p>
                    <p><strong>17.7 Force Majeure.</strong> Neither party shall be liable for any failure or delay in performance due to causes beyond their reasonable control, including acts of God, natural disasters, war, terrorism, or government actions.</p>

                    <h2 className="text-lg font-semibold mt-6">18. CONTACT INFORMATION</h2>
                    <p>If you have any questions about this Agreement, please contact us at:</p>
                    <div className="bg-muted/50 p-4 rounded-lg mt-2">
                      <p>[Your Company Name]</p>
                      <p>Email: [Legal Contact Email]</p>
                      <p>Address: [Company Address]</p>
                      <p>Website: [Company Website]</p>
                    </div>

                    <div className="bg-muted/50 p-4 rounded-lg border mt-6">
                      <p className="font-semibold">ACKNOWLEDGMENT</p>
                      <p className="mt-2 text-sm">BY USING THE SOFTWARE, YOU ACKNOWLEDGE THAT YOU HAVE READ THIS AGREEMENT, UNDERSTAND IT, AND AGREE TO BE BOUND BY ITS TERMS AND CONDITIONS.</p>
                    </div>

                    <p className="text-sm text-muted-foreground mt-6">© 2026 [Your Company Name]. All rights reserved.</p>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="privacy">
            <Card>
              <CardHeader>
                <CardTitle>Privacy Policy</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[60vh] pr-4">
                  <div className="prose prose-sm dark:prose-invert max-w-none space-y-4">
                    <p className="text-sm text-muted-foreground">Last Updated: January 8, 2026</p>
                    
                    <p>This Privacy Policy describes how [Your Company Name] ("we," "us," or "our") collects, uses, and protects your information when you use Serial Stock Suite.</p>

                    <h2 className="text-lg font-semibold mt-6">1. Information We Collect</h2>
                    <p>We collect the following types of information:</p>
                    <ul className="list-disc pl-6 space-y-1">
                      <li><strong>Account Information:</strong> Email address, name, and password when you create an account.</li>
                      <li><strong>Business Data:</strong> Inventory records, customer information, invoices, expenses, and other business data you input.</li>
                      <li><strong>Usage Data:</strong> Information about how you use the Software, including features accessed and actions taken.</li>
                      <li><strong>Device Information:</strong> Device type, operating system, and browser information for synchronization purposes.</li>
                      <li><strong>AI Interaction Data:</strong> Conversation transcripts and data processed through AI features.</li>
                    </ul>

                    <h2 className="text-lg font-semibold mt-6">2. How We Use Your Information</h2>
                    <p>We use your information to:</p>
                    <ul className="list-disc pl-6 space-y-1">
                      <li>Provide and maintain the Software and Services</li>
                      <li>Enable multi-device synchronization</li>
                      <li>Process AI-powered features and analytics</li>
                      <li>Provide customer support</li>
                      <li>Improve our products and services</li>
                      <li>Communicate with you about updates and changes</li>
                      <li>Comply with legal obligations</li>
                    </ul>

                    <h2 className="text-lg font-semibold mt-6">3. Data Security</h2>
                    <p>We implement industry-standard security measures to protect your data, including:</p>
                    <ul className="list-disc pl-6 space-y-1">
                      <li>Encrypted data transmission (HTTPS/TLS)</li>
                      <li>Role-based access controls</li>
                      <li>Row-Level Security (RLS) at the database level</li>
                      <li>Secure authentication mechanisms</li>
                      <li>Regular security audits</li>
                    </ul>

                    <h2 className="text-lg font-semibold mt-6">4. Data Sharing</h2>
                    <p>We do not sell your personal information. We may share your data with:</p>
                    <ul className="list-disc pl-6 space-y-1">
                      <li><strong>Service Providers:</strong> Third-party providers who help us deliver the Software (e.g., cloud hosting, AI services).</li>
                      <li><strong>Integrations:</strong> Third-party services you choose to connect (e.g., QuickBooks Online), subject to your authorization.</li>
                      <li><strong>Legal Requirements:</strong> When required by law or to protect our rights.</li>
                    </ul>

                    <h2 className="text-lg font-semibold mt-6">5. Your Rights</h2>
                    <p>You have the right to:</p>
                    <ul className="list-disc pl-6 space-y-1">
                      <li>Access your personal data</li>
                      <li>Correct inaccurate data</li>
                      <li>Delete your data (subject to legal retention requirements)</li>
                      <li>Export your data in standard formats</li>
                      <li>Opt-out of marketing communications</li>
                    </ul>

                    <h2 className="text-lg font-semibold mt-6">6. Data Retention</h2>
                    <p>We retain your data for as long as your account is active or as needed to provide Services. Upon account termination, you have 30 days to export your data before it is scheduled for deletion.</p>

                    <h2 className="text-lg font-semibold mt-6">7. Cookies and Tracking</h2>
                    <p>We use essential cookies and similar technologies to maintain your session and preferences. We do not use third-party tracking cookies for advertising purposes.</p>

                    <h2 className="text-lg font-semibold mt-6">8. Children's Privacy</h2>
                    <p>The Software is not intended for use by individuals under the age of 18. We do not knowingly collect personal information from children.</p>

                    <h2 className="text-lg font-semibold mt-6">9. International Data Transfers</h2>
                    <p>Your data may be processed in countries other than your own. We ensure appropriate safeguards are in place for international data transfers.</p>

                    <h2 className="text-lg font-semibold mt-6">10. Changes to This Policy</h2>
                    <p>We may update this Privacy Policy from time to time. We will notify you of significant changes through the Software or via email.</p>

                    <h2 className="text-lg font-semibold mt-6">11. Contact Us</h2>
                    <p>If you have questions about this Privacy Policy, please contact us at:</p>
                    <div className="bg-muted/50 p-4 rounded-lg mt-2">
                      <p>[Your Company Name]</p>
                      <p>Email: [Privacy Contact Email]</p>
                      <p>Address: [Company Address]</p>
                    </div>

                    <p className="text-sm text-muted-foreground mt-6">© 2026 [Your Company Name]. All rights reserved.</p>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Security Policies
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[60vh] pr-4">
                  <div className="space-y-6">
                    <div className="bg-muted/50 p-4 rounded-lg border">
                      <p className="text-sm text-muted-foreground">
                        Our security policies define the standards and procedures we follow to protect your data. 
                        These policies support our SOC 2 Type I compliance efforts.
                      </p>
                    </div>

                    <div className="grid gap-4">
                      <Card className="border-2">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Shield className="h-5 w-5 text-primary" />
                            Information Security Policy
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground mb-3">
                            Establishes the security framework and guidelines for protecting confidentiality, 
                            integrity, and availability of information assets.
                          </p>
                          <ul className="text-sm space-y-1 mb-3">
                            <li>• Access control and authentication requirements</li>
                            <li>• Data protection and encryption standards</li>
                            <li>• System security and network protection</li>
                            <li>• Business continuity and disaster recovery</li>
                          </ul>
                          <Button size="sm" variant="outline" onClick={() => handleDownloadPolicy('Information Security')}>
                            View Full Policy
                          </Button>
                        </CardContent>
                      </Card>

                      <Card className="border-2">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <BookOpen className="h-5 w-5 text-primary" />
                            Acceptable Use Policy
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground mb-3">
                            Defines acceptable and prohibited uses of Serial Stock Suite and its services.
                          </p>
                          <ul className="text-sm space-y-1 mb-3">
                            <li>• Authorized and prohibited activities</li>
                            <li>• Account security requirements</li>
                            <li>• Data handling responsibilities</li>
                            <li>• Monitoring and enforcement</li>
                          </ul>
                          <Button size="sm" variant="outline" onClick={() => handleDownloadPolicy('Acceptable Use')}>
                            View Full Policy
                          </Button>
                        </CardContent>
                      </Card>

                      <Card className="border-2">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-primary" />
                            Incident Response Policy
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground mb-3">
                            Procedures for detecting, responding to, and recovering from security incidents.
                          </p>
                          <ul className="text-sm space-y-1 mb-3">
                            <li>• Incident classification and severity levels</li>
                            <li>• Response phases and procedures</li>
                            <li>• Communication and escalation</li>
                            <li>• Post-incident review and improvement</li>
                          </ul>
                          <Button size="sm" variant="outline" onClick={() => handleDownloadPolicy('Incident Response')}>
                            View Full Policy
                          </Button>
                        </CardContent>
                      </Card>

                      <Card className="border-2">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Database className="h-5 w-5 text-primary" />
                            Data Handling Policy
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground mb-3">
                            Requirements for handling, storage, transmission, and disposal of data.
                          </p>
                          <ul className="text-sm space-y-1 mb-3">
                            <li>• Data classification levels</li>
                            <li>• Collection, storage, and retention</li>
                            <li>• Third-party data sharing</li>
                            <li>• Data subject rights</li>
                          </ul>
                          <Button size="sm" variant="outline" onClick={() => handleDownloadPolicy('Data Handling')}>
                            View Full Policy
                          </Button>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="compliance">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  SOC 2 Compliance Documentation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[60vh] pr-4">
                  <div className="space-y-6">
                    <div className="bg-muted/50 p-4 rounded-lg border">
                      <p className="text-sm text-muted-foreground">
                        These documents provide detailed technical information about our security controls 
                        and architecture for SOC 2 Type I compliance audits.
                      </p>
                    </div>

                    <div className="grid gap-4">
                      <Card className="border-2">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg">Access Control Model</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground mb-3">
                            Role-Based Access Control (RBAC) implementation, Row-Level Security policies, 
                            and authentication mechanisms.
                          </p>
                          <Button size="sm" variant="outline" onClick={() => handleDownloadPolicy('Access Control')}>
                            View Document
                          </Button>
                        </CardContent>
                      </Card>

                      <Card className="border-2">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg">Data Flow Diagram</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground mb-3">
                            System architecture, data flows, trust boundaries, and security controls 
                            at each processing stage.
                          </p>
                          <Button size="sm" variant="outline" onClick={() => handleDownloadPolicy('Data Flow')}>
                            View Document
                          </Button>
                        </CardContent>
                      </Card>

                      <Card className="border-2">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg">Encryption Strategy</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground mb-3">
                            Encryption standards, key management, data classification, and protection 
                            mechanisms for data at rest and in transit.
                          </p>
                          <Button size="sm" variant="outline" onClick={() => handleDownloadPolicy('Encryption')}>
                            View Document
                          </Button>
                        </CardContent>
                      </Card>

                      <Card className="border-2">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg">Logging & Monitoring Strategy</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground mb-3">
                            Audit logging implementation, security monitoring, alerting procedures, 
                            and SIEM integration capabilities.
                          </p>
                          <Button size="sm" variant="outline" onClick={() => handleDownloadPolicy('Logging & Monitoring')}>
                            View Document
                          </Button>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="bg-primary/10 p-4 rounded-lg border border-primary/20 mt-6">
                      <h3 className="font-semibold mb-2">Request Compliance Documentation</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        For SOC 2 audit reports, penetration test results, or additional compliance 
                        documentation, please contact our security team.
                      </p>
                      <p className="text-sm">
                        <strong>Email:</strong> security@[company-domain].com
                      </p>
                    </div>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Share Section */}
        <Card className="mt-6">
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-center sm:text-left">
                <p className="font-medium">Share this page</p>
                <p className="text-sm text-muted-foreground">Share our legal documents with anyone</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleCopyLink} className="flex items-center gap-2">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied!" : "Copy Link"}
                </Button>
                <Button onClick={handleShare} className="flex items-center gap-2">
                  <Share2 className="h-4 w-4" />
                  Share
                </Button>
              </div>
            </div>
            <div className="mt-3 p-2 bg-muted rounded-md">
              <code className="text-xs break-all">{shareUrl || '/legal'}</code>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Legal;

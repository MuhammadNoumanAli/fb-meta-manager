<template>
  <v-card-text>
    <div class="d-flex flex-wrap align-center justify-space-between ga-3 mb-4">
      <div>
        <div class="text-subtitle-1 font-weight-medium">WhatsApp Business</div>
        <div class="text-body-2 text-medium-emphasis">
          Connect senders, manage approved templates, and audit delivery and consent.
        </div>
      </div>
      <div class="d-flex flex-wrap align-center ga-2">
        <v-chip size="small" variant="tonal" color="success">
          {{ activeAccountCount }} active sender{{ activeAccountCount === 1 ? '' : 's' }}
        </v-chip>
        <v-btn
          size="small"
          variant="text"
          prepend-icon="mdi-refresh"
          :loading="loading"
          @click="load"
        >
          Refresh
        </v-btn>
        <v-btn
          v-if="canManage"
          size="small"
          variant="tonal"
          prepend-icon="mdi-seed-outline"
          :loading="seeding"
          @click="seedDefaults"
        >
          Seed defaults
        </v-btn>
        <v-btn
          v-if="canManage"
          size="small"
          color="primary"
          prepend-icon="mdi-whatsapp"
          @click="openAccountDialog"
        >
          Connect account
        </v-btn>
      </div>
    </div>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4" closable @click:close="error = null">
      {{ error }}
    </v-alert>

    <v-tabs v-model="section" density="compact" color="primary" class="mb-2">
      <v-tab value="accounts" prepend-icon="mdi-cellphone-message">Accounts</v-tab>
      <v-tab value="templates" prepend-icon="mdi-file-document-outline">Templates</v-tab>
      <v-tab value="messages" prepend-icon="mdi-message-text-outline">History</v-tab>
      <v-tab value="consent" prepend-icon="mdi-shield-account-outline">Consent</v-tab>
    </v-tabs>

    <v-window v-model="section">
      <v-window-item value="accounts">
        <v-alert
          v-if="accounts.length === 0"
          type="info"
          variant="tonal"
          density="compact"
          class="mb-4"
        >
          Connect a Meta WhatsApp Business account or a Twilio sender to start sending templates.
        </v-alert>

        <v-table v-else density="comfortable">
          <thead>
            <tr>
              <th>Account</th>
              <th>Sender numbers</th>
              <th>Status</th>
              <th>Last validated</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="account in accounts" :key="account.id">
              <td style="min-width: 220px">
                <div class="font-weight-medium">{{ account.name }}</div>
                <div class="text-caption text-medium-emphasis">
                  {{ formatWhatsappProvider(account.provider) }} ·
                  {{ account.externalAccountId }}
                </div>
                <div v-if="account.lastError" class="text-caption text-error">
                  {{ account.lastError }}
                </div>
              </td>
              <td>
                <div v-for="phone in account.phoneNumbers" :key="phone.id" class="text-body-2">
                  {{ phone.displayPhoneNumber }}
                  <v-chip
                    v-if="phone.isDefault"
                    size="x-small"
                    variant="tonal"
                    color="primary"
                    class="ml-1"
                  >
                    default
                  </v-chip>
                  <v-chip
                    v-if="phone.qualityRating"
                    size="x-small"
                    variant="text"
                    color="success"
                    class="ml-1"
                  >
                    {{ phone.qualityRating }}
                  </v-chip>
                </div>
                <div v-if="account.phoneNumbers.length === 0" class="text-caption text-medium-emphasis">
                  No sender number
                </div>
              </td>
              <td>
                <v-chip
                  size="small"
                  variant="tonal"
                  :color="whatsappAccountStatusColor(account.status)"
                >
                  {{ formatWhatsappAccountStatus(account.status) }}
                </v-chip>
              </td>
              <td class="text-caption">{{ formatDateTime(account.lastValidatedAt) }}</td>
              <td class="text-right" style="white-space: nowrap">
                <v-btn
                  v-if="canManage"
                  size="small"
                  variant="text"
                  prepend-icon="mdi-shield-check-outline"
                  :loading="busy === `validate:${account.id}`"
                  @click="validateAccount(account)"
                >
                  Validate
                </v-btn>
                <v-btn
                  v-if="canManage"
                  size="small"
                  variant="text"
                  prepend-icon="mdi-key-change"
                  @click="openTokenDialog(account)"
                >
                  Rotate token
                </v-btn>
                <v-btn
                  v-if="canManage && account.status !== 'disabled'"
                  size="small"
                  variant="text"
                  color="error"
                  prepend-icon="mdi-link-off"
                  @click="confirmDisableAccount(account)"
                >
                  Disable
                </v-btn>
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-window-item>

      <v-window-item value="templates">
        <div class="d-flex justify-end mb-3">
          <v-btn
            v-if="canManage"
            color="primary"
            size="small"
            prepend-icon="mdi-plus"
            @click="openTemplateDialog"
          >
            New template
          </v-btn>
        </div>

        <v-alert
          v-if="templates.length === 0"
          type="info"
          variant="tonal"
          density="compact"
          class="mb-4"
        >
          No templates yet. Seed the bilingual lead acknowledgment templates to get started.
        </v-alert>

        <v-table v-else density="comfortable">
          <thead>
            <tr>
              <th>Template</th>
              <th>Language</th>
              <th>Category</th>
              <th>Status</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="template in templates" :key="template.id">
              <td style="min-width: 260px">
                <div class="font-weight-medium">
                  {{ template.name }}
                  <v-chip
                    v-if="template.isAcknowledgment"
                    size="x-small"
                    variant="tonal"
                    color="teal"
                    class="ml-1"
                  >
                    auto-ack
                  </v-chip>
                </div>
                <div class="text-caption text-medium-emphasis">{{ template.body }}</div>
                <div v-if="template.rejectionReason" class="text-caption text-error">
                  {{ template.rejectionReason }}
                </div>
              </td>
              <td class="text-body-2">{{ template.language }}</td>
              <td class="text-body-2">{{ formatStatus(template.category) }}</td>
              <td>
                <v-chip
                  size="small"
                  variant="tonal"
                  :color="whatsappTemplateStatusColor(template.status)"
                >
                  {{ formatWhatsappTemplateStatus(template.status) }}
                </v-chip>
              </td>
              <td class="text-right" style="white-space: nowrap">
                <v-btn
                  v-if="canManage && (template.status === 'draft' || template.status === 'rejected')"
                  size="small"
                  variant="text"
                  prepend-icon="mdi-send-check-outline"
                  :loading="busy === `submit:${template.id}`"
                  @click="submitTemplate(template)"
                >
                  Submit
                </v-btn>
                <template v-if="canManage && template.status === 'pending'">
                  <v-btn
                    size="small"
                    variant="text"
                    color="success"
                    prepend-icon="mdi-check"
                    :loading="busy === `approve:${template.id}`"
                    @click="approveTemplate(template)"
                  >
                    Approve
                  </v-btn>
                  <v-btn
                    size="small"
                    variant="text"
                    color="error"
                    prepend-icon="mdi-close"
                    @click="openRejectDialog(template)"
                  >
                    Reject
                  </v-btn>
                </template>
                <v-btn
                  v-if="canManage && template.status === 'approved'"
                  size="small"
                  variant="text"
                  color="error"
                  prepend-icon="mdi-eye-off-outline"
                  @click="confirmDisableTemplate(template)"
                >
                  Disable
                </v-btn>
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-window-item>

      <v-window-item value="messages">
        <div class="d-flex flex-wrap align-center ga-2 mb-3">
          <v-select
            v-model="messageStatus"
            :items="messageStatusOptions"
            label="Delivery status"
            density="compact"
            variant="outlined"
            hide-details
            clearable
            style="max-width: 220px"
            @update:model-value="applyMessageFilters"
          />
          <v-text-field
            v-model="messageSearch"
            label="Search phone or text"
            density="compact"
            variant="outlined"
            hide-details
            prepend-inner-icon="mdi-magnify"
            style="max-width: 280px"
            @keyup.enter="applyMessageFilters"
          />
          <v-btn size="small" variant="tonal" @click="applyMessageFilters">Apply</v-btn>
        </div>

        <v-table density="comfortable">
          <thead>
            <tr>
              <th>Created</th>
              <th>To</th>
              <th>Message</th>
              <th>Status</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="message in messages" :key="message.id">
              <td class="text-caption" style="white-space: nowrap">
                {{ formatDateTime(message.createdAt) }}
              </td>
              <td style="min-width: 150px">
                <div class="text-body-2">{{ message.toPhone }}</div>
                <v-chip
                  size="x-small"
                  variant="text"
                  :color="message.direction === 'inbound' ? 'info' : 'primary'"
                >
                  {{ formatStatus(message.direction) }}
                </v-chip>
              </td>
              <td style="min-width: 260px">
                <div class="text-body-2 text-truncate" style="max-width: 360px">
                  {{ message.body || '—' }}
                </div>
                <div v-if="message.error" class="text-caption text-error text-truncate" style="max-width: 360px">
                  {{ message.error }}
                </div>
              </td>
              <td>
                <v-chip
                  size="small"
                  variant="tonal"
                  :color="whatsappMessageStatusColor(message.status)"
                >
                  {{ formatWhatsappMessageStatus(message.status) }}
                </v-chip>
              </td>
              <td class="text-right">
                <v-btn
                  size="small"
                  variant="text"
                  prepend-icon="mdi-open-in-new"
                  @click="openMessage(message)"
                >
                  View
                </v-btn>
              </td>
            </tr>
            <tr v-if="messages.length === 0">
              <td colspan="5" class="text-center text-medium-emphasis py-6">
                No WhatsApp messages yet.
              </td>
            </tr>
          </tbody>
        </v-table>

        <div class="d-flex align-center justify-space-between mt-4">
          <div class="text-caption text-medium-emphasis">
            {{ messageTotal }} message{{ messageTotal === 1 ? '' : 's' }}
          </div>
          <v-pagination
            v-model="messagePage"
            :length="messagePageCount"
            total-visible="5"
            density="compact"
            @update:model-value="loadMessages"
          />
        </div>
      </v-window-item>

      <v-window-item value="consent">
        <v-row dense>
          <v-col cols="12" lg="6">
            <v-card border flat>
              <v-card-title class="text-subtitle-1">Consent records</v-card-title>
              <v-card-subtitle>
                Explicit WhatsApp opt-ins and opt-outs captured from forms, inbound replies and the CRM.
              </v-card-subtitle>
              <v-card-text>
                <v-table density="compact">
                  <thead>
                    <tr>
                      <th>Phone</th>
                      <th>Status</th>
                      <th>Source</th>
                      <th>Captured</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="consent in consents" :key="consent.id">
                      <td class="text-body-2">{{ consent.phoneNumber || '—' }}</td>
                      <td>
                        <v-chip
                          size="x-small"
                          variant="tonal"
                          :color="consent.status === 'granted' ? 'success' : consent.status === 'denied' ? 'error' : 'default'"
                        >
                          {{ formatConsent(consent.status) }}
                        </v-chip>
                      </td>
                      <td class="text-caption">{{ formatStatus(consent.source) }}</td>
                      <td class="text-caption">{{ formatDateTime(consent.capturedAt) }}</td>
                    </tr>
                    <tr v-if="consents.length === 0">
                      <td colspan="4" class="text-center text-medium-emphasis py-4">
                        No consent records yet.
                      </td>
                    </tr>
                  </tbody>
                </v-table>
              </v-card-text>
            </v-card>
          </v-col>

          <v-col cols="12" lg="6">
            <v-card border flat>
              <v-card-title class="d-flex align-center justify-space-between">
                <span class="text-subtitle-1">Suppression list</span>
                <v-btn
                  v-if="canManage"
                  size="small"
                  variant="tonal"
                  prepend-icon="mdi-plus"
                  @click="openSuppressionDialog"
                >
                  Block number
                </v-btn>
              </v-card-title>
              <v-card-subtitle>
                Opt-outs, complaints and manual blocks prevent every outbound WhatsApp message.
              </v-card-subtitle>
              <v-card-text>
                <v-table density="compact">
                  <thead>
                    <tr>
                      <th>Phone</th>
                      <th>Reason</th>
                      <th>Added</th>
                      <th v-if="canManage" class="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="suppression in suppressions" :key="suppression.id">
                      <td class="text-body-2">{{ suppression.phoneNumber }}</td>
                      <td>
                        <v-chip size="x-small" variant="tonal" color="error">
                          {{ formatSuppressionReason(suppression.reason) }}
                        </v-chip>
                        <div v-if="suppression.notes" class="text-caption text-medium-emphasis">
                          {{ suppression.notes }}
                        </div>
                      </td>
                      <td class="text-caption">{{ formatDateTime(suppression.createdAt) }}</td>
                      <td v-if="canManage" class="text-right">
                        <v-btn
                          size="small"
                          variant="text"
                          color="error"
                          icon="mdi-delete-outline"
                          :loading="busy === `suppression:${suppression.id}`"
                          @click="removeSuppression(suppression)"
                        />
                      </td>
                    </tr>
                    <tr v-if="suppressions.length === 0">
                      <td :colspan="canManage ? 4 : 3" class="text-center text-medium-emphasis py-4">
                        No suppressed numbers.
                      </td>
                    </tr>
                  </tbody>
                </v-table>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-window-item>
    </v-window>

    <v-dialog v-model="accountDialog" max-width="640" persistent>
      <v-card>
        <v-card-title class="pt-5">Connect WhatsApp account</v-card-title>
        <v-card-subtitle>
          Credentials are encrypted server-side and never returned to the browser.
        </v-card-subtitle>
        <v-card-text>
          <v-alert v-if="dialogError" type="error" variant="tonal" density="compact" class="mb-4">
            {{ dialogError }}
          </v-alert>
          <v-row dense>
            <v-col cols="12" sm="6">
              <v-select
                v-model="accountForm.provider"
                :items="providerOptions"
                label="Provider"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="accountForm.name" label="Display name" />
            </v-col>
          </v-row>
          <v-text-field
            v-model="accountForm.externalAccountId"
            :label="accountForm.provider === 'meta' ? 'WhatsApp Business Account ID' : 'Twilio Account SID'"
            class="mb-2"
          />
          <v-text-field
            v-model="accountForm.accessToken"
            :label="accountForm.provider === 'meta' ? 'Permanent access token' : 'Twilio auth token'"
            type="password"
            autocomplete="new-password"
            class="mb-2"
          />
          <v-text-field
            v-if="accountForm.provider === 'meta'"
            v-model="accountForm.businessAccountId"
            label="Business account ID (optional)"
            class="mb-2"
          />
          <div class="text-caption text-medium-emphasis mb-2">Sender numbers</div>
          <v-row
            v-for="(phone, index) in accountForm.phoneNumbers"
            :key="index"
            dense
            class="align-center"
          >
            <v-col cols="12" sm="5">
              <v-text-field
                v-model="phone.externalPhoneNumberId"
                :label="accountForm.provider === 'meta' ? 'Phone number ID' : 'Sender number'"
                density="compact"
              />
            </v-col>
            <v-col cols="12" sm="5">
              <v-text-field
                v-model="phone.displayPhoneNumber"
                label="Display number"
                placeholder="+60123456789"
                density="compact"
              />
            </v-col>
            <v-col cols="12" sm="2" class="d-flex align-center ga-1">
              <v-btn
                v-if="accountForm.phoneNumbers.length > 1"
                icon="mdi-delete-outline"
                size="small"
                variant="text"
                color="error"
                @click="removePhoneRow(index)"
              />
            </v-col>
          </v-row>
          <v-btn size="small" variant="text" prepend-icon="mdi-plus" @click="addPhoneRow">
            Add sender number
          </v-btn>
        </v-card-text>
        <v-card-actions class="px-6 pb-5">
          <v-spacer />
          <v-btn variant="text" @click="accountDialog = false">Cancel</v-btn>
          <v-btn color="primary" :loading="saving" @click="createAccount">Connect</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="tokenDialog" max-width="520">
      <v-card>
        <v-card-title class="pt-5">Rotate credentials</v-card-title>
        <v-card-subtitle>
          The new token replaces the stored value for {{ tokenTarget?.name }}.
        </v-card-subtitle>
        <v-card-text>
          <v-alert v-if="dialogError" type="error" variant="tonal" density="compact" class="mb-4">
            {{ dialogError }}
          </v-alert>
          <v-text-field
            v-model="tokenValue"
            label="New access token"
            type="password"
            autocomplete="new-password"
          />
        </v-card-text>
        <v-card-actions class="px-6 pb-5">
          <v-spacer />
          <v-btn variant="text" @click="tokenDialog = false">Cancel</v-btn>
          <v-btn color="primary" :loading="saving" @click="rotateToken">Save token</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="templateDialog" max-width="680" persistent>
      <v-card>
        <v-card-title class="pt-5">New WhatsApp template</v-card-title>
        <v-card-subtitle>
          Templates must be approved before they can be sent. Protected marketing sends are blocked.
        </v-card-subtitle>
        <v-card-text>
          <v-alert v-if="dialogError" type="error" variant="tonal" density="compact" class="mb-4">
            {{ dialogError }}
          </v-alert>
          <v-row dense>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="templateForm.name"
                label="Template name"
                placeholder="order_update"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="templateForm.language" label="Language code" placeholder="en" />
            </v-col>
          </v-row>
          <v-row dense>
            <v-col cols="12" sm="6">
              <v-select
                v-model="templateForm.category"
                :items="templateCategoryOptions"
                label="Category"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-select
                v-model="templateForm.accountId"
                :items="accountOptions"
                label="Sender account"
                clearable
              />
            </v-col>
          </v-row>
          <v-text-field
            v-model="templateForm.providerTemplateId"
            label="Provider template ID (Twilio ContentSid)"
            class="mb-2"
          />
          <v-textarea
            v-model="templateForm.body"
            label="Template body"
            rows="3"
            auto-grow
            class="mb-2"
          />
          <v-textarea
            v-model="templateForm.variableMapping"
            label="Variable mapping (JSON)"
            hint='Maps placeholders to lead fields, e.g. {"1":"lead.fullName","2":"business.name"}'
            persistent-hint
            rows="2"
            auto-grow
            class="mb-2"
          />
          <v-checkbox
            v-model="templateForm.isAcknowledgment"
            label="Use for automatic lead acknowledgments"
            density="compact"
            hide-details
          />
        </v-card-text>
        <v-card-actions class="px-6 pb-5">
          <v-spacer />
          <v-btn variant="text" @click="templateDialog = false">Cancel</v-btn>
          <v-btn color="primary" :loading="saving" @click="createTemplate">Create template</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="rejectDialog" max-width="520">
      <v-card>
        <v-card-title class="pt-5">Reject template</v-card-title>
        <v-card-subtitle>{{ rejectTarget?.name }}</v-card-subtitle>
        <v-card-text>
          <v-alert v-if="dialogError" type="error" variant="tonal" density="compact" class="mb-4">
            {{ dialogError }}
          </v-alert>
          <v-text-field v-model="rejectReason" label="Rejection reason" />
        </v-card-text>
        <v-card-actions class="px-6 pb-5">
          <v-spacer />
          <v-btn variant="text" @click="rejectDialog = false">Cancel</v-btn>
          <v-btn color="error" :loading="saving" @click="rejectTemplate">Reject</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="suppressionDialog" max-width="520">
      <v-card>
        <v-card-title class="pt-5">Block a phone number</v-card-title>
        <v-card-text>
          <v-alert v-if="dialogError" type="error" variant="tonal" density="compact" class="mb-4">
            {{ dialogError }}
          </v-alert>
          <v-text-field
            v-model="suppressionForm.phoneNumber"
            label="Phone number"
            placeholder="+60123456789"
            class="mb-2"
          />
          <v-select
            v-model="suppressionForm.reason"
            :items="suppressionReasonOptions"
            label="Reason"
            class="mb-2"
          />
          <v-text-field v-model="suppressionForm.notes" label="Notes" />
        </v-card-text>
        <v-card-actions class="px-6 pb-5">
          <v-spacer />
          <v-btn variant="text" @click="suppressionDialog = false">Cancel</v-btn>
          <v-btn color="primary" :loading="saving" @click="addSuppression">Block number</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="messageDialog" max-width="640">
      <v-card v-if="messageDetail">
        <v-card-title class="d-flex align-center justify-space-between">
          <span>Message timeline</span>
          <v-chip
            size="small"
            variant="tonal"
            :color="whatsappMessageStatusColor(messageDetail.status)"
          >
            {{ formatWhatsappMessageStatus(messageDetail.status) }}
          </v-chip>
        </v-card-title>
        <v-card-text>
          <div class="text-body-2 mb-1"><strong>To:</strong> {{ messageDetail.toPhone }}</div>
          <div class="text-body-2 mb-1">
            <strong>Direction:</strong> {{ formatStatus(messageDetail.direction) }}
          </div>
          <div class="text-body-2 mb-1">
            <strong>External ID:</strong> {{ messageDetail.externalMessageId || '—' }}
          </div>
          <div class="text-body-2 mb-1">
            <strong>Attempts:</strong> {{ messageDetail.attempts }} / {{ messageDetail.maxAttempts }}
          </div>
          <div v-if="messageDetail.error" class="text-body-2 text-error mb-2">
            {{ messageDetail.error }}
          </div>
          <v-sheet v-if="messageDetail.body" color="surface-variant" rounded class="pa-3 text-body-2 mb-3">
            {{ messageDetail.body }}
          </v-sheet>

          <div class="text-caption text-medium-emphasis mb-1">Events</div>
          <v-timeline density="compact" side="end" truncate-line="both">
            <v-timeline-item
              v-for="event in messageDetail.events"
              :key="event.id"
              :dot-color="whatsappMessageStatusColor(event.status)"
              size="x-small"
            >
              <div class="text-body-2">{{ event.eventType || formatWhatsappMessageStatus(event.status) }}</div>
              <div class="text-caption text-medium-emphasis">{{ formatDateTime(event.occurredAt) }}</div>
              <div v-if="event.error" class="text-caption text-error">{{ event.error }}</div>
            </v-timeline-item>
          </v-timeline>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            v-if="canManage && messageDetail.status === 'failed' && messageDetail.direction === 'outbound'"
            color="primary"
            variant="tonal"
            :loading="busy === `retry:${messageDetail.id}`"
            @click="retryMessage"
          >
            Retry message
          </v-btn>
          <v-btn variant="text" @click="messageDialog = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="confirmDialog" max-width="460">
      <v-card>
        <v-card-title class="pt-5">{{ confirmTitle }}</v-card-title>
        <v-card-text>{{ confirmMessage }}</v-card-text>
        <v-card-actions class="px-6 pb-5">
          <v-spacer />
          <v-btn variant="text" @click="confirmDialog = false">Cancel</v-btn>
          <v-btn color="error" :loading="saving" @click="runConfirm">Confirm</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar" :color="snackbarColor" timeout="3500">
      {{ snackbarMessage }}
    </v-snackbar>
  </v-card-text>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ApiError } from '@/services/api/client';
import { whatsappApi } from '@/services/api/whatsapp.api';
import type {
  CommunicationSuppression,
  CreateWhatsappAccountInput,
  LeadConsent,
  SuppressionReason,
  WhatsappAccount,
  WhatsappMessage,
  WhatsappMessageDetail,
  WhatsappMessageStatus,
  WhatsappPhoneNumberInput,
  WhatsappProvider,
  WhatsappTemplate,
  WhatsappTemplateCategory,
} from '@/types/whatsapp';
import { formatDateTime } from '@/utils/format';
import {
  formatConsent,
  formatStatus,
  formatSuppressionReason,
  formatWhatsappAccountStatus,
  formatWhatsappMessageStatus,
  formatWhatsappProvider,
  formatWhatsappTemplateStatus,
  whatsappAccountStatusColor,
  whatsappMessageStatusColor,
  whatsappTemplateStatusColor,
} from '@/utils/labels';

const props = defineProps<{
  businessId: string;
  canManage: boolean;
}>();

const section = ref('accounts');
const accounts = ref<WhatsappAccount[]>([]);
const templates = ref<WhatsappTemplate[]>([]);
const messages = ref<WhatsappMessage[]>([]);
const messageTotal = ref(0);
const messagePage = ref(1);
const messagePageSize = 15;
const messageStatus = ref<WhatsappMessageStatus | null>(null);
const messageSearch = ref('');
const consents = ref<LeadConsent[]>([]);
const suppressions = ref<CommunicationSuppression[]>([]);

const loading = ref(true);
const saving = ref(false);
const seeding = ref(false);
const busy = ref<string | null>(null);
const error = ref<string | null>(null);
const dialogError = ref<string | null>(null);

const accountDialog = ref(false);
const tokenDialog = ref(false);
const templateDialog = ref(false);
const rejectDialog = ref(false);
const suppressionDialog = ref(false);
const messageDialog = ref(false);
const confirmDialog = ref(false);

const tokenTarget = ref<WhatsappAccount | null>(null);
const tokenValue = ref('');
const rejectTarget = ref<WhatsappTemplate | null>(null);
const rejectReason = ref('');
const messageDetail = ref<WhatsappMessageDetail | null>(null);
const confirmTitle = ref('');
const confirmMessage = ref('');
const confirmAction = ref<null | (() => Promise<void>)>(null);

const snackbar = ref(false);
const snackbarMessage = ref('');
const snackbarColor = ref('success');

const accountForm = ref({
  provider: 'meta' as WhatsappProvider,
  name: '',
  externalAccountId: '',
  accessToken: '',
  businessAccountId: '',
  phoneNumbers: [
    { externalPhoneNumberId: '', displayPhoneNumber: '', isDefault: true },
  ] as WhatsappPhoneNumberInput[],
});

const templateForm = ref({
  name: '',
  language: 'en',
  category: 'utility' as WhatsappTemplateCategory,
  body: '',
  accountId: null as string | null,
  providerTemplateId: '',
  isAcknowledgment: false,
  variableMapping: '{"1":"lead.fullName","2":"business.name"}',
});

const suppressionForm = ref({
  phoneNumber: '',
  reason: 'manual' as SuppressionReason,
  notes: '',
});

const providerOptions = [
  { title: 'Meta Cloud API', value: 'meta' },
  { title: 'Twilio', value: 'twilio' },
];

const templateCategoryOptions = [
  { title: 'Utility', value: 'utility' },
  { title: 'Marketing', value: 'marketing' },
  { title: 'Authentication', value: 'authentication' },
];

const suppressionReasonOptions = [
  { title: 'Manual block', value: 'manual' },
  { title: 'Opted out', value: 'opt_out' },
  { title: 'Complaint', value: 'complaint' },
];

const messageStatusOptions = [
  'queued',
  'sending',
  'sent',
  'delivered',
  'read',
  'failed',
  'received',
  'skipped',
  'suppressed',
].map((value) => ({ title: formatWhatsappMessageStatus(value), value }));

const activeAccountCount = computed(
  () => accounts.value.filter((account) => account.status === 'active').length,
);

const accountOptions = computed(() =>
  accounts.value.map((account) => ({
    title: `${account.name} (${formatWhatsappProvider(account.provider)})`,
    value: account.id,
  })),
);

const messagePageCount = computed(() =>
  Math.max(1, Math.ceil(messageTotal.value / messagePageSize)),
);

function notify(message: string, color = 'success'): void {
  snackbarMessage.value = message;
  snackbarColor.value = color;
  snackbar.value = true;
}

function describeError(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.message : fallback;
}

function resetDialogError(): void {
  dialogError.value = null;
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;

  try {
    const [accountList, templateList, consentList, suppressionList] = await Promise.all([
      whatsappApi.listAccounts(props.businessId),
      whatsappApi.listTemplates(props.businessId, { page: 1, pageSize: 100 }),
      whatsappApi.listConsents(props.businessId),
      whatsappApi.listSuppressions(props.businessId),
    ]);

    accounts.value = accountList;
    templates.value = templateList.items;
    consents.value = consentList;
    suppressions.value = suppressionList;
    await loadMessages();
  } catch (caught) {
    error.value = describeError(caught, 'Unable to load WhatsApp data.');
  } finally {
    loading.value = false;
  }
}

async function loadMessages(): Promise<void> {
  try {
    const result = await whatsappApi.listMessages(props.businessId, {
      page: messagePage.value,
      pageSize: messagePageSize,
      status: messageStatus.value ?? undefined,
      search: (messageSearch.value ?? '').trim() || undefined,
    });
    messages.value = result.items;
    messageTotal.value = result.total;
  } catch (caught) {
    error.value = describeError(caught, 'Unable to load WhatsApp messages.');
  }
}

function applyMessageFilters(): void {
  messagePage.value = 1;
  void loadMessages();
}

function openAccountDialog(): void {
  resetDialogError();
  accountForm.value = {
    provider: 'meta',
    name: '',
    externalAccountId: '',
    accessToken: '',
    businessAccountId: '',
    phoneNumbers: [{ externalPhoneNumberId: '', displayPhoneNumber: '', isDefault: true }],
  };
  accountDialog.value = true;
}

function addPhoneRow(): void {
  accountForm.value.phoneNumbers.push({
    externalPhoneNumberId: '',
    displayPhoneNumber: '',
    isDefault: false,
  });
}

function removePhoneRow(index: number): void {
  accountForm.value.phoneNumbers.splice(index, 1);
}

async function createAccount(): Promise<void> {
  saving.value = true;
  resetDialogError();

  try {
    const form = accountForm.value;
    const payload: CreateWhatsappAccountInput = {
      provider: form.provider,
      name: form.name.trim(),
      externalAccountId: form.externalAccountId.trim(),
      accessToken: form.accessToken,
      businessAccountId: form.businessAccountId.trim() || undefined,
      phoneNumbers: form.phoneNumbers
        .filter(
          (phone) =>
            phone.externalPhoneNumberId.trim() && phone.displayPhoneNumber.trim(),
        )
        .map((phone, index) => ({
          externalPhoneNumberId: phone.externalPhoneNumberId.trim(),
          displayPhoneNumber: phone.displayPhoneNumber.trim(),
          isDefault: phone.isDefault === true || index === 0,
        })),
    };

    await whatsappApi.createAccount(props.businessId, payload);
    accountDialog.value = false;
    notify('WhatsApp account connected.');
    await load();
  } catch (caught) {
    dialogError.value = describeError(caught, 'Unable to connect the account.');
  } finally {
    saving.value = false;
  }
}

async function validateAccount(account: WhatsappAccount): Promise<void> {
  busy.value = `validate:${account.id}`;

  try {
    await whatsappApi.validateAccount(props.businessId, account.id);
    notify('Account validated with the provider.');
    accounts.value = await whatsappApi.listAccounts(props.businessId);
  } catch (caught) {
    notify(describeError(caught, 'Unable to validate the account.'), 'error');
  } finally {
    busy.value = null;
  }
}

function openTokenDialog(account: WhatsappAccount): void {
  resetDialogError();
  tokenTarget.value = account;
  tokenValue.value = '';
  tokenDialog.value = true;
}

async function rotateToken(): Promise<void> {
  if (!tokenTarget.value) {
    return;
  }

  saving.value = true;
  resetDialogError();

  try {
    await whatsappApi.updateAccount(props.businessId, tokenTarget.value.id, {
      accessToken: tokenValue.value,
    });
    tokenDialog.value = false;
    notify('Credentials rotated.');
    accounts.value = await whatsappApi.listAccounts(props.businessId);
  } catch (caught) {
    dialogError.value = describeError(caught, 'Unable to rotate the credentials.');
  } finally {
    saving.value = false;
  }
}

function confirmDisableAccount(account: WhatsappAccount): void {
  confirmTitle.value = 'Disable WhatsApp account?';
  confirmMessage.value = `${account.name} will stop sending messages. Message history is kept.`;
  confirmAction.value = async () => {
    busy.value = `disable:${account.id}`;
    try {
      await whatsappApi.disableAccount(props.businessId, account.id);
      notify('Account disabled.');
      accounts.value = await whatsappApi.listAccounts(props.businessId);
    } catch (caught) {
      notify(describeError(caught, 'Unable to disable the account.'), 'error');
    } finally {
      busy.value = null;
    }
  };
  confirmDialog.value = true;
}

function openTemplateDialog(): void {
  resetDialogError();
  templateForm.value = {
    name: '',
    language: 'en',
    category: 'utility',
    body: '',
    accountId: null,
    providerTemplateId: '',
    isAcknowledgment: false,
    variableMapping: '{"1":"lead.fullName","2":"business.name"}',
  };
  templateDialog.value = true;
}

async function createTemplate(): Promise<void> {
  saving.value = true;
  resetDialogError();

  try {
    let variableMapping: Record<string, string> | undefined;

    if (templateForm.value.variableMapping.trim()) {
      variableMapping = JSON.parse(templateForm.value.variableMapping) as Record<
        string,
        string
      >;
    }

    await whatsappApi.createTemplate(props.businessId, {
      name: templateForm.value.name.trim(),
      language: templateForm.value.language.trim(),
      category: templateForm.value.category,
      body: templateForm.value.body.trim(),
      variableMapping,
      accountId: templateForm.value.accountId ?? undefined,
      providerTemplateId: templateForm.value.providerTemplateId.trim() || undefined,
      isAcknowledgment: templateForm.value.isAcknowledgment,
    });
    templateDialog.value = false;
    notify('Template created as a draft.');
    templates.value = (
      await whatsappApi.listTemplates(props.businessId, { page: 1, pageSize: 100 })
    ).items;
  } catch (caught) {
    dialogError.value =
      caught instanceof SyntaxError
        ? 'Variable mapping must be valid JSON.'
        : describeError(caught, 'Unable to create the template.');
  } finally {
    saving.value = false;
  }
}

async function seedDefaults(): Promise<void> {
  seeding.value = true;

  try {
    const seeded = await whatsappApi.seedDefaultTemplates(props.businessId);
    notify(
      seeded.length > 0
        ? `${seeded.length} default template${seeded.length === 1 ? '' : 's'} seeded.`
        : 'Default templates already exist.',
    );
    templates.value = (
      await whatsappApi.listTemplates(props.businessId, { page: 1, pageSize: 100 })
    ).items;
  } catch (caught) {
    notify(describeError(caught, 'Unable to seed templates.'), 'error');
  } finally {
    seeding.value = false;
  }
}

async function submitTemplate(template: WhatsappTemplate): Promise<void> {
  busy.value = `submit:${template.id}`;

  try {
    await whatsappApi.submitTemplate(props.businessId, template.id);
    notify('Template submitted for approval.');
    await reloadTemplates();
  } catch (caught) {
    notify(describeError(caught, 'Unable to submit the template.'), 'error');
  } finally {
    busy.value = null;
  }
}

async function approveTemplate(template: WhatsappTemplate): Promise<void> {
  busy.value = `approve:${template.id}`;

  try {
    await whatsappApi.approveTemplate(props.businessId, template.id);
    notify('Template approved.');
    await reloadTemplates();
  } catch (caught) {
    notify(describeError(caught, 'Unable to approve the template.'), 'error');
  } finally {
    busy.value = null;
  }
}

function openRejectDialog(template: WhatsappTemplate): void {
  resetDialogError();
  rejectTarget.value = template;
  rejectReason.value = '';
  rejectDialog.value = true;
}

async function rejectTemplate(): Promise<void> {
  if (!rejectTarget.value) {
    return;
  }

  saving.value = true;
  resetDialogError();

  try {
    await whatsappApi.rejectTemplate(
      props.businessId,
      rejectTarget.value.id,
      rejectReason.value.trim(),
    );
    rejectDialog.value = false;
    notify('Template rejected.');
    await reloadTemplates();
  } catch (caught) {
    dialogError.value = describeError(caught, 'Unable to reject the template.');
  } finally {
    saving.value = false;
  }
}

function confirmDisableTemplate(template: WhatsappTemplate): void {
  confirmTitle.value = 'Disable template?';
  confirmMessage.value = `${template.name} can no longer be sent until it is approved again.`;
  confirmAction.value = async () => {
    try {
      await whatsappApi.disableTemplate(props.businessId, template.id);
      notify('Template disabled.');
      await reloadTemplates();
    } catch (caught) {
      notify(describeError(caught, 'Unable to disable the template.'), 'error');
    }
  };
  confirmDialog.value = true;
}

async function reloadTemplates(): Promise<void> {
  templates.value = (
    await whatsappApi.listTemplates(props.businessId, { page: 1, pageSize: 100 })
  ).items;
}

async function openMessage(message: WhatsappMessage): Promise<void> {
  messageDetail.value = null;
  messageDialog.value = true;

  try {
    messageDetail.value = await whatsappApi.getMessage(props.businessId, message.id);
  } catch (caught) {
    messageDialog.value = false;
    notify(describeError(caught, 'Unable to load the message.'), 'error');
  }
}

async function retryMessage(): Promise<void> {
  if (!messageDetail.value) {
    return;
  }

  busy.value = `retry:${messageDetail.value.id}`;

  try {
    messageDetail.value = await whatsappApi.retryMessage(
      props.businessId,
      messageDetail.value.id,
    );
    notify('Message re-queued.');
    await loadMessages();
  } catch (caught) {
    notify(describeError(caught, 'Unable to retry the message.'), 'error');
  } finally {
    busy.value = null;
  }
}

function openSuppressionDialog(): void {
  resetDialogError();
  suppressionForm.value = { phoneNumber: '', reason: 'manual', notes: '' };
  suppressionDialog.value = true;
}

async function addSuppression(): Promise<void> {
  saving.value = true;
  resetDialogError();

  try {
    await whatsappApi.addSuppression(props.businessId, {
      phoneNumber: suppressionForm.value.phoneNumber.trim(),
      reason: suppressionForm.value.reason,
      notes: suppressionForm.value.notes.trim() || undefined,
    });
    suppressionDialog.value = false;
    notify('Number added to the suppression list.');
    suppressions.value = await whatsappApi.listSuppressions(props.businessId);
  } catch (caught) {
    dialogError.value = describeError(caught, 'Unable to block the number.');
  } finally {
    saving.value = false;
  }
}

async function removeSuppression(suppression: CommunicationSuppression): Promise<void> {
  busy.value = `suppression:${suppression.id}`;

  try {
    await whatsappApi.removeSuppression(props.businessId, suppression.id);
    notify('Suppression removed.');
    suppressions.value = await whatsappApi.listSuppressions(props.businessId);
  } catch (caught) {
    notify(describeError(caught, 'Unable to remove the suppression.'), 'error');
  } finally {
    busy.value = null;
  }
}

async function runConfirm(): Promise<void> {
  const action = confirmAction.value;

  if (!action) {
    confirmDialog.value = false;
    return;
  }

  saving.value = true;

  try {
    await action();
    confirmDialog.value = false;
  } finally {
    saving.value = false;
    confirmAction.value = null;
  }
}

onMounted(load);
</script>
